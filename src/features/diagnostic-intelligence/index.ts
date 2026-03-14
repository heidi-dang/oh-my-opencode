/**
 * Diagnostic Intelligence — Barrel export.
 *
 * Provides error classification, repair playbook lookup,
 * structured repair instructions, and cross-session signature memory.
 */

export type {
  DiagnosticClass,
  DiagnosticLanguage,
  DiagnosticSeverity,
  ClassifiedDiagnostic,
  RepairStrategy,
  RepairPlaybook,
  DecisionNode,
  RepairSignature,
  DiagnosticRepairInstructions,
} from "./types"

export {
  classifyDiagnostic,
  classifyDiagnostics,
  isKnownDiagnosticPattern,
} from "./classifier"

export {
  getPlaybook,
  hasPlaybook,
  getRegisteredClasses,
} from "./playbook-registry"

export {
  buildRepairInstructions,
  formatRepairInstructionsForAgent,
  buildBatchRepairInstructions,
} from "./repair-instructions-builder"

export {
  recordRepairSuccess,
  recordRepairFailure,
  getSignatures,
  recordVerificationPattern,
  recordFixPattern,
} from "./signature-memory"

export { runtimeInterceptor } from "./runtime-interceptor"
export { memoryWatchdog } from "./memory-watchdog"
export { networkInterceptor } from "./network-interceptor"
export { performanceMonitor } from "./performance-monitor"
export { uiUxMonitor } from "./ui-ux-monitor"
