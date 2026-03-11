/**
 * Task State Machine — Lifecycle spine of the Controlled Agent Runtime.
 *
 * TRUTH OWNERSHIP: This component owns lifecycle state and transitions ONLY.
 * It does NOT own evidence (StateLedger), history (ExecutionJournal),
 * or verification results (VerificationEngine).
 *
 * ENFORCEMENT: Transitions are called by runtime-gates.ts, NOT by Heidi directly.
 * Only CompletionFirewall may promote to DONE.
 */

import { log } from "../../shared/logger"
import type {
  TaskState,
  TaskIntent,
  AcceptanceStatus,
  RepairRecord,
  VerificationResult,
  TaskPlan,
} from "./types"
import type { TaskRecord } from "./task-record"
import { createTaskRecord } from "./task-record"

const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  NEW: ["INTERPRETING", "BLOCKED"],
  INTERPRETING: ["RETRIEVING", "BLOCKED"],
  RETRIEVING: ["PLANNED", "BLOCKED"],
  PLANNED: ["EXECUTING", "BLOCKED"],
  EXECUTING: ["VERIFYING", "BLOCKED"],
  VERIFYING: ["REPAIRING", "BLOCKED"],
  REPAIRING: ["EXECUTING", "VERIFYING", "BLOCKED"],
  DONE: ["NEW"],
  BLOCKED: ["NEW", "INTERPRETING", "RETRIEVING", "PLANNED", "EXECUTING"],
}

/** Maximum repair loops before BLOCKED */
const DEFAULT_MAX_REPAIRS = 3

export class TaskStateMachine {
  private tasks = new Map<string, TaskRecord>()

  createTask(sessionID: string, rawPrompt: string): TaskRecord {
    const record = createTaskRecord(sessionID, rawPrompt)
    this.tasks.set(sessionID, record)
    log(`[TaskStateMachine] Created task ${record.task_id} for session ${sessionID}`)
    return record
  }

  getTask(sessionID: string): TaskRecord | undefined {
    return this.tasks.get(sessionID)
  }

  /**
   * Attempt a state transition. Called by runtime-gates.ts, NOT by Heidi.
   *
   * DONE is intentionally excluded from VERIFYING's allowed transitions.
   * Only `promoteToDone()` (called by CompletionFirewall) can set DONE.
   */
  transition(sessionID: string, targetState: TaskState): boolean {
    const record = this.tasks.get(sessionID)
    if (!record) {
      log(`[TaskStateMachine] No task found for session ${sessionID}`)
      return false
    }

    if (targetState === "DONE") {
      log(`[TaskStateMachine] Direct transition to DONE blocked. Use promoteToDone() via CompletionFirewall.`)
      return false
    }

    const allowed = VALID_TRANSITIONS[record.lifecycle_state]
    if (!allowed.includes(targetState)) {
      log(`[TaskStateMachine] Invalid transition: ${record.lifecycle_state} → ${targetState} for session ${sessionID}`)
      return false
    }

    if (targetState === "REPAIRING") {
      if (record.repair_loop_count >= DEFAULT_MAX_REPAIRS) {
        log(`[TaskStateMachine] Max repairs reached (${DEFAULT_MAX_REPAIRS}) for session ${sessionID}, forcing BLOCKED`)
        record.lifecycle_state = "BLOCKED"
        record.blocked_reason = `Exceeded max repair loops (${DEFAULT_MAX_REPAIRS})`
        record.updated_at = Date.now()
        return false
      }
      record.repair_loop_count++
    }

    if (targetState === "BLOCKED") {
      // Caller must set blocked_reason and blocked_remaining via setBlockedReason()
    }

    const previous = record.lifecycle_state
    record.lifecycle_state = targetState
    record.updated_at = Date.now()
    log(`[TaskStateMachine] ${previous} → ${targetState} for session ${sessionID}`)
    return true
  }

  /**
   * Promote task to DONE. Only callable by CompletionFirewall.
   * Requires the task to be in VERIFYING state.
   */
  promoteToDone(sessionID: string): boolean {
    const record = this.tasks.get(sessionID)
    if (!record) return false

    if (record.lifecycle_state !== "VERIFYING") {
      log(`[TaskStateMachine] promoteToDone rejected: state is ${record.lifecycle_state}, expected VERIFYING`)
      return false
    }

    record.lifecycle_state = "DONE"
    record.updated_at = Date.now()
    log(`[TaskStateMachine] VERIFYING → DONE for session ${sessionID} (promoted by CompletionFirewall)`)
    return true
  }

  setIntent(sessionID: string, intent: TaskIntent): void {
    const record = this.tasks.get(sessionID)
    if (record) {
      record.interpreted_intent = intent
      record.rollback_policy = intent.rollback_policy
      record.updated_at = Date.now()
    }
  }

  setPlan(sessionID: string, plan: TaskPlan): void {
    const record = this.tasks.get(sessionID)
    if (record) {
      record.approved_plan = plan
      record.updated_at = Date.now()
    }
  }

  setBlockedReason(sessionID: string, reason: string, remaining?: string[]): void {
    const record = this.tasks.get(sessionID)
    if (record) {
      record.blocked_reason = reason
      record.blocked_remaining = remaining
      record.updated_at = Date.now()
    }
  }

  recordChangedFile(sessionID: string, filePath: string): void {
    const record = this.tasks.get(sessionID)
    if (record && !record.changed_files.includes(filePath)) {
      record.changed_files.push(filePath)
      record.updated_at = Date.now()
    }
  }

  updateAcceptanceStatuses(sessionID: string, statuses: AcceptanceStatus[]): void {
    const record = this.tasks.get(sessionID)
    if (record) {
      record.acceptance_statuses = statuses
      record.updated_at = Date.now()
    }
  }

  setVerificationResult(sessionID: string, result: VerificationResult): void {
    const record = this.tasks.get(sessionID)
    if (record) {
      record.latest_verification = result
      record.updated_at = Date.now()
    }
  }

  recordRepair(sessionID: string, repair: Omit<RepairRecord, "attempt" | "timestamp">): void {
    const record = this.tasks.get(sessionID)
    if (record) {
      record.repairs.push({
        ...repair,
        attempt: record.repair_loop_count,
        timestamp: Date.now(),
      })
      record.updated_at = Date.now()
    }
  }

  getAcceptanceScore(sessionID: string): { total: number; passed: number; ratio: number } {
    const record = this.tasks.get(sessionID)
    if (!record?.interpreted_intent?.acceptance_criteria?.length) {
      return { total: 0, passed: 0, ratio: 1 }
    }
    const total = record.interpreted_intent.acceptance_criteria.length
    const passed = record.acceptance_statuses.filter(s => s.passed).length
    return { total, passed, ratio: total > 0 ? passed / total : 1 }
  }

  getStateReport(sessionID: string): string {
    const record = this.tasks.get(sessionID)
    if (!record) return "[CAR] No active task."

    const score = this.getAcceptanceScore(sessionID)
    const lines = [
      `[CAR] State: ${record.lifecycle_state}`,
      `[CAR] Task type: ${record.interpreted_intent?.task_type ?? "unknown"}`,
      `[CAR] Repair loops: ${record.repair_loop_count}/${DEFAULT_MAX_REPAIRS}`,
      `[CAR] Acceptance: ${score.passed}/${score.total} criteria passed`,
      `[CAR] Changed files: ${record.changed_files.length}`,
    ]

    if (record.lifecycle_state === "BLOCKED" && record.blocked_reason) {
      lines.push(`[CAR] Blocked: ${record.blocked_reason}`)
      if (record.blocked_remaining?.length) {
        lines.push(`[CAR] Remaining: ${record.blocked_remaining.join(", ")}`)
      }
    }

    return lines.join("\n")
  }

  clearTask(sessionID: string): void {
    this.tasks.delete(sessionID)
  }
}

export const taskStateMachine = new TaskStateMachine()
