import { z } from "zod"
import type {
  TaskState,
  TaskType,
  TaskIntent,
  AcceptanceStatus,
  RepairRecord,
  VerificationResult,
  TaskPlan,
  RollbackPolicy,
} from "./types"

export interface TaskRecord {
  /** Unique task ID (generated at creation) */
  task_id: string

  /** Session ID this task belongs to */
  session_id: string

  /** Raw user prompt that started the task */
  raw_prompt: string

  /** Structured intent from the interpreter */
  interpreted_intent?: TaskIntent

  /** References to files included in the retrieval bundle */
  retrieval_bundle_refs: string[]

  /** Approved plan (after quality gate) */
  approved_plan?: TaskPlan

  /** Current lifecycle state */
  lifecycle_state: TaskState

  /** Number of repair loops used */
  repair_loop_count: number

  /** Repair history */
  repairs: RepairRecord[]

  /** Files changed during execution */
  changed_files: string[]

  /** Latest verification result (structured) */
  latest_verification?: VerificationResult

  /** Acceptance statuses (runtime evaluation results) */
  acceptance_statuses: AcceptanceStatus[]

  /** Blocker reason if state is BLOCKED */
  blocked_reason?: string

  /** Remaining acceptance criteria not yet met */
  blocked_remaining?: string[]

  /** Rollback policy for this task */
  rollback_policy: RollbackPolicy

  /** Git stash ref if checkpoint was created */
  rollback_ref?: string

  /** Created timestamp */
  created_at: number

  /** Last updated timestamp */
  updated_at: number
}

export const TaskRecordSchema = z.object({
  task_id: z.string(),
  session_id: z.string(),
  raw_prompt: z.string(),
  interpreted_intent: z.any().optional(),
  retrieval_bundle_refs: z.array(z.string()),
  approved_plan: z.any().optional(),
  lifecycle_state: z.string() as z.ZodType<TaskState>,
  repair_loop_count: z.number(),
  repairs: z.array(z.any()),
  changed_files: z.array(z.string()),
  latest_verification: z.any().optional(),
  acceptance_statuses: z.array(z.any()),
  blocked_reason: z.string().optional(),
  blocked_remaining: z.array(z.string()).optional(),
  rollback_policy: z.string() as z.ZodType<RollbackPolicy>,
  rollback_ref: z.string().optional(),
  created_at: z.number(),
  updated_at: z.number(),
})

let taskIDCounter = 0

export function createTaskRecord(sessionID: string, rawPrompt: string): TaskRecord {
  taskIDCounter++
  return {
    task_id: `car_${Date.now()}_${taskIDCounter}`,
    session_id: sessionID,
    raw_prompt: rawPrompt,
    retrieval_bundle_refs: [],
    lifecycle_state: "NEW",
    repair_loop_count: 0,
    repairs: [],
    changed_files: [],
    acceptance_statuses: [],
    rollback_policy: "noop",
    created_at: Date.now(),
    updated_at: Date.now(),
  }
}

export function serializeTaskRecord(record: TaskRecord): string {
  return JSON.stringify(record, null, 2)
}

export function deserializeTaskRecord(json: string): TaskRecord {
  const parsed = JSON.parse(json)
  return TaskRecordSchema.parse(parsed) as TaskRecord
}
