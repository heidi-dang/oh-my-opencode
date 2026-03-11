/**
 * Post-Tool Watchdog — Ensures continuation fires after every tool completes.
 *
 * Hooks into tool.execute.after. If no state transition or assistant output
 * occurs within the threshold, flags the stall and hands off to the StallDetector.
 */

import { log } from "../../shared/logger"
import { stallDetector } from "./stall-detector"

const POST_TOOL_THRESHOLD_MS = 10_000 // 10 seconds

const pendingWatchdogs = new Map<string, NodeJS.Timer>()

/**
 * Called after every tool execution completes.
 * Starts a countdown — if no activity is recorded before it expires,
 * the StallDetector is notified.
 */
export function armPostToolWatchdog(sessionID: string, toolName: string): void {
  // Clear any existing watchdog for this session
  disarmPostToolWatchdog(sessionID)

  const timer = setTimeout(() => {
    log(`[PostToolWatchdog] No continuation after tool "${toolName}" in session ${sessionID} for ${POST_TOOL_THRESHOLD_MS}ms`)
    // The stall detector's next sweep will pick this up since we did NOT record activity
    pendingWatchdogs.delete(sessionID)
  }, POST_TOOL_THRESHOLD_MS)

  pendingWatchdogs.set(sessionID, timer)
}

/**
 * Called when activity is observed (token output, state transition, etc.).
 * Disarms the watchdog since continuation is confirmed.
 */
export function disarmPostToolWatchdog(sessionID: string): void {
  const existing = pendingWatchdogs.get(sessionID)
  if (existing) {
    clearTimeout(existing)
    pendingWatchdogs.delete(sessionID)
  }
  // Also tell the stall detector that activity happened
  stallDetector.recordActivity(sessionID)
}

/**
 * Clean up when a session ends.
 */
export function clearPostToolWatchdog(sessionID: string): void {
  disarmPostToolWatchdog(sessionID)
  stallDetector.clearSession(sessionID)
}
