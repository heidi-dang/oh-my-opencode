/**
 * User Notifier — Pushes concise status messages during stall recovery.
 *
 * These are short banners/toasts that inform the user about what Heidi
 * is doing when she detects a stall, so the terminal doesn't feel frozen.
 *
 * Wording is now routed through the user-facing-status formatter for
 * consistent tone across the entire runtime.
 */

import { log } from "../../shared/logger"
import type { StallClass } from "./types"
import type { ToneMode } from "../user-facing-status/types"
import { formatRecoveryEvent } from "../user-facing-status/formatter"

/** Active tone — can be changed at runtime via config. */
let activeTone: ToneMode = "friendly"

export function setNotifierTone(tone: ToneMode): void {
  activeTone = tone
}

/**
 * Get the user-facing message for a detected stall.
 */
export function getStallMessage(stallClass: StallClass): string {
  const formatted = formatRecoveryEvent(stallClass, activeTone)
  return formatted.headline
}

/**
 * Get the user-facing message for a recovery event.
 */
export function getRecoveryMessage(event: string): string {
  const formatted = formatRecoveryEvent(event, activeTone)
  return formatted.headline
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
export function notifyRecoveryStatus(sessionID: string, event: string): void {
  const message = getRecoveryMessage(event)
  log(`[UserNotifier] [${sessionID}] ${message}`)
}
