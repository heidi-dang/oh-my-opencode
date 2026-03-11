/**
 * Stall Recovery — Barrel export.
 */

export type {
  StallClass,
  StallSymptom,
  ProcessHealth,
  TrackedProcess,
  RecoveryStepResult,
  RecoveryAttempt,
} from "./types"

export { StallDetector, stallDetector } from "./stall-detector"
export { tryRecovery } from "./recovery-manager"
export { armPostToolWatchdog, disarmPostToolWatchdog, clearPostToolWatchdog } from "./post-tool-watchdog"
export {
  trackProcess,
  recordProcessOutput,
  markProcessExited,
  reconcileProcess,
  classifySessionProcesses,
  getStalledProcesses,
  clearSessionProcesses,
} from "./process-liveness"
export {
  getStallMessage,
  getRecoveryMessage,
  notifyStallDetected,
  notifyRecoveryStatus,
} from "./user-notifier"
