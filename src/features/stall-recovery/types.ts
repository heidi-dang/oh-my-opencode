/**
 * Stall Recovery Types — Definitions for stall detection, process liveness, and auto-recovery.
 */

import type { TaskRecord } from "../controlled-agent-runtime/task-record"

export type StallClass =
  | "edit_review_wait_stall"
  | "background_tool_hang"
  | "post_tool_continuation_lost"
  | "verification_never_started"
  | "completion_gate_deadlock"
  | "unknown_runtime_stall"

export interface StallSymptom {
  stall_class: StallClass
  detected_at: number
  description: string
  associated_process_id?: number
  last_tool_name?: string
}

export type ProcessHealth =
  | "running_normally"
  | "idle_but_alive"
  | "stalled_no_output"
  | "exited_but_not_reconciled"
  | "orphaned"

export interface TrackedProcess {
  pid: number
  command: string
  session_id: string
  started_at: number
  last_output_at: number
  last_known_health: ProcessHealth
  timeout_ms?: number
  cancelable: boolean
  exited: boolean
}

export type RecoveryStepResult =
  | "reconciled"      // State was synced properly (e.g., waiting for review)
  | "nudged"          // Successfully forced state machine to next phase
  | "process_killed"  // Hung ghost process was killed
  | "subagent_started" // Runtime Recovery Engineer was spawned
  | "failed"          // Step failed to resolve the stall

export interface RecoveryAttempt {
  stall_symptom: StallSymptom
  steps_taken: string[]
  resolved: boolean
  escalated_to_subagent: boolean
  started_at: number
  ended_at?: number
}
