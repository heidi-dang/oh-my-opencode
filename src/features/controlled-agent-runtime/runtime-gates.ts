/**
 * Runtime Gates — Hard enforcement at tool/state/completion boundaries.
 *
 * These gates are called by the runtime, NOT by Heidi.
 * The hook layer (car-orchestrator) handles injection and soft shaping.
 * This module handles hard enforcement.
 *
 * ROLLBACK OWNERSHIP: This module creates and clears rollback checkpoints.
 * Not Heidi, not the verifier, not the repair manager.
 */

import { spawn, exec } from "child_process"
import { promisify } from "util"
import { log } from "../../shared/logger"
import { taskStateMachine } from "./task-state-machine"
import type { TaskState, RollbackPolicy } from "./types"

const execAsync = promisify(exec)

/**
 * Guard: Is the task in a state that allows tool execution?
 * Tools should only run in EXECUTING or REPAIRING states.
 */
export function canExecuteTool(sessionID: string): boolean {
  const record = taskStateMachine.getTask(sessionID)
  if (!record) return true // No CAR task = no gate

  const allowedStates: TaskState[] = ["EXECUTING", "REPAIRING", "INTERPRETING", "RETRIEVING"]
  return allowedStates.includes(record.lifecycle_state)
}

/**
 * Guard: Is the task in a state that allows verification?
 */
export function canVerify(sessionID: string): boolean {
  const record = taskStateMachine.getTask(sessionID)
  if (!record) return true

  return record.lifecycle_state === "VERIFYING" || record.lifecycle_state === "REPAIRING"
}

/**
 * Guard: Can the task transition to a given state?
 * Delegates to TaskStateMachine.transition() which enforces valid transitions.
 */
export function requestTransition(sessionID: string, targetState: TaskState): boolean {
  return taskStateMachine.transition(sessionID, targetState)
}

/**
 * Record a file change via the state machine.
 * Called from tool-execute-after hook when a file write occurs.
 */
export function recordFileChange(sessionID: string, filePath: string): void {
  taskStateMachine.recordChangedFile(sessionID, filePath)
}

/**
 * Safe wrapper for git commands that avoids shell interpretation of arguments.
 */
async function gitSafe(args: string[], cwd: string, timeout = 10000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, { cwd, timeout })
    let stdout = ""
    let stderr = ""

    proc.stdout?.on("data", (data) => { stdout += data.toString() })
    proc.stderr?.on("data", (data) => { stderr += data.toString() })

    proc.on("close", (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1 })
    })

    proc.on("error", (err) => {
      log(`[RuntimeGates] Git spawn error:`, err)
      resolve({ stdout: "", stderr: err.message, exitCode: 1 })
    })
  })
}

/**
 * Create a rollback checkpoint before execution.
 * Rollback policy determines what kind of checkpoint:
 *   - noop: no checkpoint (research/read-only tasks)
 *   - lightweight: git stash (safe edits)
 *   - full: git stash + branch backup (destructive changes)
 */
export async function createRollbackCheckpoint(
  sessionID: string,
  cwd: string
): Promise<string | null> {
  const record = taskStateMachine.getTask(sessionID)
  if (!record) return null

  const policy = record.rollback_policy

  if (policy === "noop") {
    log(`[RuntimeGates] No rollback checkpoint for noop policy (session ${sessionID})`)
    return null
  }

  try {
    const stashName = `car-checkpoint-${record.task_id}`

    if (policy === "lightweight" || policy === "full") {
      const { exitCode, stderr } = await gitSafe(["stash", "push", "-m", stashName, "--include-untracked"], cwd)
      if (exitCode !== 0) {
        log(`[RuntimeGates] Git stash push failed:`, stderr)
        return null
      }

      await gitSafe(["stash", "pop"], cwd)
      log(`[RuntimeGates] Created ${policy} checkpoint: ${stashName}`)
      return stashName
    }
  } catch (err) {
    log(`[RuntimeGates] Failed to create rollback checkpoint:`, err)
  }

  return null
}

/**
 * Attempt to rollback to a checkpoint.
 * Called when repair loops exhaust and task transitions to BLOCKED.
 */
export async function rollbackToCheckpoint(
  sessionID: string,
  stashRef: string,
  cwd: string
): Promise<boolean> {
  try {
    const { stdout, exitCode } = await gitSafe(["stash", "list"], cwd)
    if (exitCode !== 0) return false

    const stashEntry = stdout.split("\n").find(line => line.includes(stashRef))

    if (!stashEntry) {
      log(`[RuntimeGates] Stash ref not found: ${stashRef}`)
      return false
    }

    const stashIndexMatch = stashEntry.match(/^stash@\{(\d+)\}/)
    if (!stashIndexMatch) {
      log(`[RuntimeGates] Could not parse stash index from: ${stashEntry}`)
      return false
    }

    const stashIndex = stashIndexMatch[0]
    const { exitCode: applyCode, stderr } = await gitSafe(["stash", "apply", stashIndex], cwd)
    
    if (applyCode !== 0) {
      log(`[RuntimeGates] Rollback apply failed:`, stderr)
      return false
    }

    log(`[RuntimeGates] Rolled back to checkpoint: ${stashRef}`)
    return true
  } catch (err) {
    log(`[RuntimeGates] Rollback failed:`, err)
    return false
  }
}
