/**
 * Controlled Agent Runtime (CAR) — Barrel Export
 *
 * The mandatory pipeline that wraps Heidi:
 *   Interpret → Retrieve → Plan → Execute → Verify → Repair → Complete
 *
 * CAR wraps Heidi. Heidi does not opt into CAR.
 */

// Types (canonical source of truth for all interfaces)
export type {
  TaskState,
  TaskType,
  RollbackPolicy,
  AcceptanceCriterion,
  AcceptanceStatus,
  TaskIntent,
  RepairRecord,
  TaskContext,
  CheckResult,
  VerificationResult,
  PlanStepTarget,
  PlanStep,
  TaskPlan,
  DiffVerificationResult,
} from "./types"

// Task Record (persistent shape)
export { createTaskRecord, serializeTaskRecord, deserializeTaskRecord } from "./task-record"
export type { TaskRecord } from "./task-record"

// Telemetry (Phase 0 baseline measurement)
export { carTelemetry } from "./telemetry"
export type { TelemetryRecord } from "./telemetry"

// Task State Machine (lifecycle spine)
export { taskStateMachine } from "./task-state-machine"

// Runtime Gates (hard enforcement)
export {
  canExecuteTool,
  canVerify,
  requestTransition,
  recordFileChange,
  createRollbackCheckpoint,
  rollbackToCheckpoint,
} from "./runtime-gates"

// Completion Firewall (ONLY promoter to DONE)
export { evaluateCompletion } from "./completion-firewall"
export type { CompletionDecision } from "./completion-firewall"

// Task Interpreter (structured intent extraction)
export { interpretTask } from "./task-interpreter"

// Context Retriever (repo-aware file retrieval)
export { buildContextBundle } from "./context-retriever"
export type { ContextBundle, ContextFile, RecentCommit } from "./context-retriever"

// Plan Quality Gate (validates plans before execution)
export { validatePlan, createPlanStep } from "./plan-quality-gate"
export type { PlanValidationResult } from "./plan-quality-gate"

// Verification Engine (structured 4-level verification)
export { runVerification, computeAcceptanceStatuses } from "./verification-engine"

// Diff Verifier (plan vs actual diff comparison)
export { verifyDiff } from "./diff-verifier"

// Unfinished Detector (pre-completion integrity scan)
export { detectUnfinished } from "./unfinished-detector"
export type { UnfinishedDetectionResult, UnfinishedCheck } from "./unfinished-detector"
