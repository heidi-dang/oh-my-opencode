/**
 * CAR Types — All shared Controlled Agent Runtime interfaces.
 *
 * Truth ownership:
 *   - TaskStateMachine owns lifecycle state + transitions
 *   - StateLedger owns verified state changes (evidence)
 *   - ExecutionJournal owns chronological action history
 *   - VerificationEngine owns verification results + acceptance status
 *   - CompletionFirewall reads from all above, owns nothing
 */

// ────────────────────────────────────────────
// Task Lifecycle
// ────────────────────────────────────────────

export type TaskState =
  | "NEW"
  | "INTERPRETING"
  | "RETRIEVING"
  | "PLANNED"
  | "EXECUTING"
  | "VERIFYING"
  | "REPAIRING"
  | "DONE"
  | "BLOCKED"

export type TaskType = "bugfix" | "feature" | "refactor" | "config" | "research" | "unknown"

export type RollbackPolicy = "noop" | "lightweight" | "full"

// ────────────────────────────────────────────
// Acceptance: Requirement vs Status (split)
// ────────────────────────────────────────────

/** Static requirement — immutable after interpretation */
export interface AcceptanceCriterion {
  id: string
  description: string
  verification_method: "build" | "test" | "command" | "manual" | "lint"
  verification_command?: string
}

/** Runtime evaluation result — mutable, owned by VerificationEngine */
export interface AcceptanceStatus {
  criterion_id: string
  passed: boolean
  evidence?: string
  checked_at?: number
}

// ────────────────────────────────────────────
// Task Intent (output of interpreter)
// ────────────────────────────────────────────

export interface TaskIntent {
  goal: string
  constraints: string[]
  acceptance_criteria: AcceptanceCriterion[]
  likely_areas: string[]
  task_type: TaskType
  needs_clarification: boolean
  clarification_questions?: string[]
  forbidden_assumptions: string[]
  rollback_policy: RollbackPolicy
}

// ────────────────────────────────────────────
// Repair records
// ────────────────────────────────────────────

export interface RepairRecord {
  attempt: number
  failure_type: "build" | "test" | "retrieval" | "drift" | "incomplete"
  failure_evidence: string
  action_taken: string
  timestamp: number
}

// ────────────────────────────────────────────
// Task Context (state machine owns this)
// ────────────────────────────────────────────

export interface TaskContext {
  sessionID: string
  state: TaskState
  intent?: TaskIntent
  acceptance_statuses: AcceptanceStatus[]
  plan_summary?: string
  repair_count: number
  max_repairs: number
  repairs: RepairRecord[]
  changed_files: string[]
  verification_evidence: string[]
  blocked_reason?: string
  blocked_remaining?: string[]
  created_at: number
  last_transition_at: number
}

// ────────────────────────────────────────────
// Verification (structured result contract)
// ────────────────────────────────────────────

export interface CheckResult {
  name: string
  passed: boolean
  message: string
  details?: string
  command?: string
  exit_code?: number
}

export interface VerificationResult {
  overall_pass: boolean
  levels: {
    static: CheckResult[]
    targeted: CheckResult[]
    e2e: CheckResult[]
    regression: CheckResult[]
  }
  artifacts: string[]
  remaining_failures: string[]
}

// ────────────────────────────────────────────
// Plan step (plan quality gate)
// ────────────────────────────────────────────

export type PlanStepTarget = "file" | "tool" | "verification"

export interface PlanStep {
  id: string
  description: string
  target_type: PlanStepTarget
  target_value: string
  verification_command?: string
}

export interface TaskPlan {
  hypothesis?: string
  steps: PlanStep[]
  rollback_path?: string
  verification_commands: string[]
}

// ────────────────────────────────────────────
// Diff verification
// ────────────────────────────────────────────

export interface DiffVerificationResult {
  matches_plan: boolean
  unrelated_files: string[]
  oversized_edits: string[]
  missing_expected_files: string[]
  total_lines_changed: number
}

// ────────────────────────────────────────────
// Telemetry record
// ────────────────────────────────────────────

export interface TelemetryRecord {
  timestamp: string
  sessionID: string
  task_type: TaskType
  first_pass_success: boolean
  final_success: boolean
  false_done: boolean
  repair_loops: number
  failure_class?: string
  acceptance_score: { total: number; passed: number }
  duration_ms: number
}
