/**
 * User Notifier — Pushes concise status messages during stall recovery.
 *
 * These are short banners/toasts that inform the user about what Heidi
 * is doing when she detects a stall, so the terminal doesn't feel frozen.
 */

import { log } from "../../shared/logger"
import type { StallClass } from "./types"

const STALL_MESSAGES: Record<StallClass, string> = {
  edit_review_wait_stall: "Heidi is waiting for an edit/review confirmation to proceed.",
  background_tool_hang: "Heidi detected a background process that may be hung. Investigating...",
  post_tool_continuation_lost: "Heidi detected a stalled continuation after a tool completed. Auto-recovering...",
  verification_never_started: "Heidi detected that verification did not start after execution. Recovering...",
  completion_gate_deadlock: "Heidi detected a completion gate deadlock. Attempting recovery...",
  unknown_runtime_stall: "Heidi detected a stalled runtime state and is recovering automatically.",
}

const RECOVERY_MESSAGES = {
  recovery_started: "Automatic recovery has started. Heidi is diagnosing the root cause.",
  subagent_spawned: "A runtime debug sub-agent was spawned to inspect and fix the root cause.",
  recovery_succeeded: "Recovery succeeded. Heidi is resuming normal operation.",
  recovery_failed: "Automatic recovery could not safely continue. The task is now blocked with a diagnostic.",
}

/**
 * Get the user-facing message for a detected stall.
 */
export function getStallMessage(stallClass: StallClass): string {
  return STALL_MESSAGES[stallClass]
}

/**
 * Get the user-facing message for a recovery event.
 */
export function getRecoveryMessage(event: keyof typeof RECOVERY_MESSAGES): string {
  return RECOVERY_MESSAGES[event]
}

/**
 * Log and emit a stall notification. In the future this can push to a UI toast system.
 */
export function notifyStallDetected(sessionID: string, stallClass: StallClass): void {
  const message = getStallMessage(stallClass)
  log(`[UserNotifier] [${sessionID}] ${message}`)
}

/**
 * Log and emit a recovery status notification.
 */
export function notifyRecoveryStatus(sessionID: string, event: keyof typeof RECOVERY_MESSAGES): void {
  const message = getRecoveryMessage(event)
  log(`[UserNotifier] [${sessionID}] ${message}`)
}
