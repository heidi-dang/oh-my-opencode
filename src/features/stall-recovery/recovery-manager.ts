/**
 * Recovery Manager — Bounded auto-recovery ladder for detected stalls.
 *
 * Steps:
 *   A. Reconcile — check for pending review / waiting state mismatches
 *   B. Nudge — re-trigger the next CAR phase via requestTransition
 *   C. Process sync — kill orphaned or hung background processes
 *   D. Spawn sub-agent — dispatch Runtime Recovery Engineer
 *
 * Memory Integration: queries MemoryDB for past stall signatures to improve
 * classification and recovery strategy ordering.
 */

import { log } from "../../shared/logger"
import { taskStateMachine } from "../controlled-agent-runtime/task-state-machine"
import { requestTransition } from "../controlled-agent-runtime/runtime-gates"
import { memoryDB } from "../../shared/memory-db"
import type { TaskRecord } from "../controlled-agent-runtime/task-record"
import type { StallSymptom, RecoveryAttempt, RecoveryStepResult } from "./types"

/**
 * Try to recover from a detected stall, escalating through the recovery ladder.
 */
export async function tryRecovery(
  sessionID: string,
  symptom: StallSymptom,
  task: TaskRecord
): Promise<RecoveryAttempt> {
  const attempt: RecoveryAttempt = {
    stall_symptom: symptom,
    steps_taken: [],
    resolved: false,
    escalated_to_subagent: false,
    started_at: Date.now(),
  }

  log(`[RecoveryManager] Starting recovery for session ${sessionID} — class: ${symptom.stall_class}`)

  // Transition to STALL_DETECTED
  taskStateMachine.transition(sessionID, "STALL_DETECTED")

  // Check memory for past stall signatures
  const pastSignatures = memoryDB.query({
    category: "failure_signature",
    signature: symptom.stall_class,
  })

  if (pastSignatures.length > 0) {
    log(`[RecoveryManager] Found ${pastSignatures.length} previous signature(s) for ${symptom.stall_class}`)
  }

  // Transition to AUTO_RECOVERING
  taskStateMachine.transition(sessionID, "AUTO_RECOVERING")

  // Step A: Reconcile
  const reconcileResult = stepReconcile(sessionID, task, symptom)
  attempt.steps_taken.push(`reconcile: ${reconcileResult}`)
  if (reconcileResult === "reconciled") {
    attempt.resolved = true
    attempt.ended_at = Date.now()
    storeRecoverySignature(sessionID, symptom, attempt)
    return attempt
  }

  // Step B: Nudge
  const nudgeResult = stepNudge(sessionID, task)
  attempt.steps_taken.push(`nudge: ${nudgeResult}`)
  if (nudgeResult === "nudged") {
    attempt.resolved = true
    attempt.ended_at = Date.now()
    storeRecoverySignature(sessionID, symptom, attempt)
    return attempt
  }

  // Step C: Process sync (placeholder — needs process-liveness tracker)
  attempt.steps_taken.push("process_sync: skipped (no tracked processes)")

  // Step D: Escalate to sub-agent
  log(`[RecoveryManager] Soft recovery failed. Escalating to SUBAGENT_DEBUGGING for session ${sessionID}`)
  taskStateMachine.transition(sessionID, "SUBAGENT_DEBUGGING")
  attempt.escalated_to_subagent = true
  attempt.steps_taken.push("subagent: dispatched")
  attempt.ended_at = Date.now()

  storeRecoverySignature(sessionID, symptom, attempt)
  return attempt
}

/**
 * Step A: Check if the stall is a known waiting condition that just needs
 * state reconciliation (e.g., pending review, background process still running).
 */
function stepReconcile(
  sessionID: string,
  task: TaskRecord,
  symptom: StallSymptom
): RecoveryStepResult {
  if (symptom.stall_class === "edit_review_wait_stall") {
    const transitioned = taskStateMachine.transition(sessionID, "WAITING_FOR_EDIT_REVIEW")
    if (transitioned) {
      log(`[RecoveryManager] Reconciled: moved to WAITING_FOR_EDIT_REVIEW`)
      return "reconciled"
    }
  }

  if (symptom.stall_class === "background_tool_hang") {
    const transitioned = taskStateMachine.transition(sessionID, "WAITING_FOR_BACKGROUND_PROCESS")
    if (transitioned) {
      log(`[RecoveryManager] Reconciled: moved to WAITING_FOR_BACKGROUND_PROCESS`)
      return "reconciled"
    }
  }

  return "failed"
}

/**
 * Step B: Attempt to nudge the state machine to the next logical phase.
 */
function stepNudge(sessionID: string, task: TaskRecord): RecoveryStepResult {
  if (task.lifecycle_state === "AUTO_RECOVERING") {
    // Try to push to VERIFYING if we were in EXECUTING
    const nudged = taskStateMachine.transition(sessionID, "VERIFYING")
    if (nudged) {
      log(`[RecoveryManager] Nudged: forced AUTO_RECOVERING → VERIFYING`)
      return "nudged"
    }

    // Try EXECUTING as fallback
    const nudgedExec = taskStateMachine.transition(sessionID, "EXECUTING")
    if (nudgedExec) {
      log(`[RecoveryManager] Nudged: forced AUTO_RECOVERING → EXECUTING`)
      return "nudged"
    }
  }

  return "failed"
}

/**
 * Store recovery outcome into MemoryDB so future stalls benefit from this experience.
 */
function storeRecoverySignature(
  sessionID: string,
  symptom: StallSymptom,
  attempt: RecoveryAttempt
): void {
  memoryDB.save({
    category: "failure_signature",
    signature: symptom.stall_class,
    content: symptom.description,
    tags: `stall,recovery,${attempt.resolved ? "resolved" : "escalated"}`,
    evidence: attempt.steps_taken,
    confidence: attempt.resolved ? 0.8 : 0.4,
    last_used_at: Date.now(),
  })
}
