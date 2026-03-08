/**
 * Authoritative Completion Gate
 * 
 * This module provides a single, centralized gate for task completion determination.
 * All success finalization MUST flow through this module.
 * 
 * Completion Rules (fail-closed):
 * - rejected complete_task => task remains in_progress
 * - report_issue_verification alone => task remains in_progress (just logs state)
 * - assistant prose or "looks complete" text => no effect on task success state
 * - Stop/cancel active => finalization blocked
 * - duplicate completion events => ignored, never double-finish
 * - only successful complete_task after required verification/state checks => finished
 * - malformed/unknown tool result => task remains non-finished
 */

import { getIssueState, type IssueVerificationState } from "../features/issue-resolution/state"
import { isSessionIssueMode } from "../features/claude-code-session-state"
import { log } from "./logger"

export interface CompletionGateResult {
  /** Whether the task is allowed to complete */
  allowed: boolean
  /** Detailed reason for the result */
  reason: string
  /** Whether we found a complete_task call */
  foundCompleteTask: boolean
  /** Whether the last complete_task was rejected */
  completeTaskRejected: boolean
  /** Current issue verification state (if in issue mode) */
  issueState?: IssueVerificationState
  /** Whether stop/cancel is active */
  stopActive: boolean
}

/**
 * Check if a session has an active stop/cancel request.
 * This checks multiple sources to determine if continuation should be blocked.
 */
export function isStopActive(directory: string, sessionID: string): boolean {
  // Check stop-continuation-guard marker
  try {
    const { getContinuationMarker } = require("../features/run-continuation-state")
    const marker = getContinuationMarker(directory, sessionID, "stop")
    if (marker?.state === "stopped") {
      log("[CompletionGate] Stop marker is active:", { sessionID, marker })
      return true
    }
  } catch {
    // Continuation state module might not be available
  }
  return false
}

/**
 * Authoritative completion gate.
 * 
 * This is the ONLY function that should determine if a task can be marked complete.
 * All completion paths must flow through here.
 * 
 * @param directory - The working directory for the session
 * @param sessionID - The session ID to check
 * @param client - Optional SDK client for message inspection
 * @returns CompletionGateResult with detailed completion decision
 */
export async function checkAuthoritativeCompletion(
  directory: string,
  sessionID: string,
  client?: any
): Promise<CompletionGateResult> {
  const result: CompletionGateResult = {
    allowed: false,
    reason: "",
    foundCompleteTask: false,
    completeTaskRejected: false,
    stopActive: false,
  }

  // 1. Check if Stop/cancel is active - BLOCK completion
  result.stopActive = isStopActive(directory, sessionID)
  if (result.stopActive) {
    result.reason = "Stop/cancel is active - continuation was explicitly stopped"
    log("[CompletionGate] Blocking completion: stop active", { sessionID })
    return result
  }

  // 2. In issue resolution mode, verify all required states are met
  if (isSessionIssueMode(sessionID)) {
    const issueState = getIssueState(sessionID)
    result.issueState = issueState
    
    if (!issueState.reproduced) {
      result.reason = "Issue not reproduced - reproduced must be true to complete"
      log("[CompletionGate] Blocking completion: issue not reproduced", { sessionID })
      return result
    }
    
    if (!issueState.fixApplied) {
      result.reason = "Fix not applied - fixApplied must be true to complete"
      log("[CompletionGate] Blocking completion: fix not applied", { sessionID })
      return result
    }
    
    if (!issueState.reproAfterPassed) {
      result.reason = "Repro after fix not verified - reproAfterPassed must be true to complete"
      log("[CompletionGate] Blocking completion: repro after fix not passed", { sessionID })
      return result
    }
    
    log("[CompletionGate] Issue resolution state verified:", { sessionID, issueState })
  }

  // 3. Check for complete_task in messages (if client available)
  if (client) {
    const { verifyTaskCompletionState } = await import("./verify-task-completion")
    const isLegitimatelyComplete = await verifyTaskCompletionState(client, sessionID)
    
    result.foundCompleteTask = true
    result.completeTaskRejected = !isLegitimatelyComplete
    
    if (!isLegitimatelyComplete) {
      result.reason = "complete_task was rejected - task cannot complete until issues are resolved"
      log("[CompletionGate] Blocking completion: complete_task rejected", { sessionID })
      return result
    }
  } else {
    // Without client, we can't verify - fail closed
    result.reason = "Cannot verify completion without SDK client - blocking to ensure safety"
    log("[CompletionGate] Blocking completion: no client to verify", { sessionID })
    return result
  }

  // 4. All checks passed - allow completion
  result.allowed = true
  result.reason = "All completion conditions verified - task may complete"
  log("[CompletionGate] Allowing completion:", { sessionID })
  
  return result
}

/**
 * Determine if the current issue state allows completion.
 * This is used by complete_task tool to check before allowing completion.
 */
export function canCompleteWithIssueState(sessionID: string): { allowed: boolean; reason: string } {
  if (!isSessionIssueMode(sessionID)) {
    return { allowed: true, reason: "Not in issue resolution mode" }
  }
  
  const issueState = getIssueState(sessionID)
  
  if (!issueState.reproduced) {
    return { 
      allowed: false, 
      reason: "Issue must be reproduced (reproduced=true) before completing" 
    }
  }
  
  if (!issueState.fixApplied) {
    return { 
      allowed: false, 
      reason: "Fix must be applied (fixApplied=true) before completing" 
    }
  }
  
  if (!issueState.reproAfterPassed) {
    return { 
      allowed: false, 
      reason: "Reproduction after fix must pass (reproAfterPassed=true) before completing" 
    }
  }
  
  return { allowed: true, reason: "All issue resolution checks passed" }
}
