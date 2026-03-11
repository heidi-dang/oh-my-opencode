/**
 * Stall Detector — Heartbeat monitor for CAR sessions.
 *
 * Scans active TaskRecords periodically to detect if they have been stuck in an
 * EXECUTING or VERIFYING state for too long without any observed events.
 */

import { log } from "../../shared/logger"
import { taskStateMachine } from "../controlled-agent-runtime/task-state-machine"
import type { TaskRecord } from "../controlled-agent-runtime/task-record"
import type { StallSymptom, StallClass } from "./types"
import { tryRecovery } from "./recovery-manager"

const STALL_THRESHOLD_MS = 45_000 // 45 seconds without any activity implies a stall

export class StallDetector {
  private activeInterval: NodeJS.Timer | null = null
  private lastActivityLog = new Map<string, number>()

  /**
   * Start the watchdog loop.
   */
  startWatching(): void {
    if (this.activeInterval) return

    // Run every 10 seconds to check for >45s stalls
    this.activeInterval = setInterval(() => {
      this.checkAllActiveSessions()
    }, 10_000)
    
    log(`[StallDetector] Started watching sessions... (Threshold: 45s)`)
  }

  /**
   * Stop the watchdog loop.
   */
  stopWatching(): void {
    if (this.activeInterval) {
      clearInterval(this.activeInterval)
      this.activeInterval = null
    }
  }

  /**
   * Update the latest activity timestamp for a session.
   * Call this from plugins/hooks on every token or tool event.
   */
  recordActivity(sessionID: string): void {
    this.lastActivityLog.set(sessionID, Date.now())
  }

  /**
   * Explicitly clear tracking for a finished session.
   */
  clearSession(sessionID: string): void {
    this.lastActivityLog.delete(sessionID)
  }

  /**
   * Scan the state machine for stalled tasks.
   */
  private checkAllActiveSessions(): void {
    // Only check sessions in susceptible execution states
    const vulnerableStates = ["EXECUTING", "VERIFYING", "REPAIRING"]
    const now = Date.now()

    // Using any available way to iterate tasks (we need to expose an iterator or list method if we can't access `tasks`)
    // Given we can't expose `tasks` map directly from task-state-machine easily without editing it again,
    // we'll rely on the orchestrator to pass the session list, or we add an accessor to taskStateMachine.
    // Let's assume `taskStateMachine.getActiveSessions()` exists or we'll add it shortly.
    const activeSessions = taskStateMachine.getActiveSessions()

    for (const sessionID of activeSessions) {
      const task = taskStateMachine.getTask(sessionID)
      if (!task || !vulnerableStates.includes(task.lifecycle_state)) {
        continue
      }

      // Time since last heartbeat
      const lastActivity = this.lastActivityLog.get(sessionID) || task.updated_at
      const idleTime = now - lastActivity

      if (idleTime > STALL_THRESHOLD_MS) {
        this.handleStallDetected(sessionID, task, idleTime)
      }
    }
  }

  private handleStallDetected(sessionID: string, task: TaskRecord, idleTimeMs: number): void {
    log(`[StallDetector] Silent stall detected in session ${sessionID}! Idle for ${idleTimeMs}ms in state ${task.lifecycle_state}`)
    
    // Classify
    let stallClass: StallClass = "unknown_runtime_stall"
    
    // If there's a file changed but no verification ever started
    if (task.lifecycle_state === "EXECUTING" && task.changed_files.length > 0) {
      stallClass = "post_tool_continuation_lost"
    } else if (task.lifecycle_state === "VERIFYING") {
      stallClass = "verification_never_started"
    }
    // We would refine this with tracking edit/review states, background tools...

    const symptom: StallSymptom = {
      stall_class: stallClass,
      detected_at: Date.now(),
      description: `Task stuck in ${task.lifecycle_state} for ${(idleTimeMs / 1000).toFixed(1)}s`,
    }

    // Set tracker to now so we don't spam recovery every 10 seconds while it recovers
    this.recordActivity(sessionID)

    // Trigger recovery
    tryRecovery(sessionID, symptom, task)
  }
}

export const stallDetector = new StallDetector()
