/**
 * Process Liveness Tracker — Monitors spawned background processes.
 *
 * Tracks PID, start time, last output, and health classification.
 * Used by the RecoveryManager to distinguish "still loading" from
 * "runtime forgot to advance".
 */

import { log } from "../../shared/logger"
import type { TrackedProcess, ProcessHealth } from "./types"

const trackedProcesses = new Map<number, TrackedProcess>()

/**
 * Register a new background process for tracking.
 */
export function trackProcess(opts: {
  pid: number
  command: string
  session_id: string
  timeout_ms?: number
  cancelable?: boolean
}): void {
  const now = Date.now()
  trackedProcesses.set(opts.pid, {
    pid: opts.pid,
    command: opts.command,
    session_id: opts.session_id,
    started_at: now,
    last_output_at: now,
    last_known_health: "running_normally",
    timeout_ms: opts.timeout_ms,
    cancelable: opts.cancelable ?? true,
    exited: false,
  })
  log(`[ProcessLiveness] Tracking PID ${opts.pid}: ${opts.command}`)
}

/**
 * Record output from a tracked process (proves it's still alive).
 */
export function recordProcessOutput(pid: number): void {
  const proc = trackedProcesses.get(pid)
  if (proc) {
    proc.last_output_at = Date.now()
    proc.last_known_health = "running_normally"
  }
}

/**
 * Mark a process as exited.
 */
export function markProcessExited(pid: number): void {
  const proc = trackedProcesses.get(pid)
  if (proc) {
    proc.exited = true
    proc.last_known_health = "exited_but_not_reconciled"
    log(`[ProcessLiveness] PID ${pid} exited but not yet reconciled`)
  }
}

/**
 * Reconcile an exited process (remove from tracking).
 */
export function reconcileProcess(pid: number): void {
  trackedProcesses.delete(pid)
}

/**
 * Classify health of all tracked processes for a given session.
 */
export function classifySessionProcesses(sessionID: string): TrackedProcess[] {
  const now = Date.now()
  const results: TrackedProcess[] = []

  for (const proc of trackedProcesses.values()) {
    if (proc.session_id !== sessionID) continue

    if (proc.exited) {
      proc.last_known_health = "exited_but_not_reconciled"
    } else {
      const idleTime = now - proc.last_output_at
      const timeout = proc.timeout_ms ?? 60_000

      if (idleTime > timeout) {
        proc.last_known_health = "stalled_no_output"
      } else if (idleTime > 30_000) {
        proc.last_known_health = "idle_but_alive"
      } else {
        proc.last_known_health = "running_normally"
      }
    }

    results.push({ ...proc })
  }

  return results
}

/**
 * Get all stalled or orphaned processes for a session.
 */
export function getStalledProcesses(sessionID: string): TrackedProcess[] {
  return classifySessionProcesses(sessionID).filter(
    p => p.last_known_health === "stalled_no_output" || p.last_known_health === "orphaned"
  )
}

/**
 * Clear all tracked processes for a session.
 */
export function clearSessionProcesses(sessionID: string): void {
  for (const [pid, proc] of trackedProcesses) {
    if (proc.session_id === sessionID) {
      trackedProcesses.delete(pid)
    }
  }
}
