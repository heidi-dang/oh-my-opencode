/**
 * CAR Repair Manager — Failure-classified retry logic for the CAR pipeline.
 *
 * Extends the existing SelfHealingManager with structured repair loops.
 * Each retry receives the VerificationResult, failure classification,
 * changed files, and remaining acceptance criteria.
 *
 * Max 3 repair loops. Each loop classifies the failure and adjusts strategy.
 * After exhaustion → BLOCKED with evidence.
 */

import { log } from "../../shared/logger"
import { taskStateMachine } from "../controlled-agent-runtime/task-state-machine"
import { requestTransition } from "../controlled-agent-runtime/runtime-gates"
import type { VerificationResult, RepairRecord } from "../controlled-agent-runtime/types"
import { classifyDiagnostics } from "../diagnostic-intelligence/classifier"
import { buildBatchRepairInstructions } from "../diagnostic-intelligence/repair-instructions-builder"

export type RepairFailureType = "build" | "test" | "retrieval" | "drift" | "incomplete"

function classifyFailure(verification: VerificationResult): RepairFailureType {
  const staticFails = verification.levels.static.filter(r => !r.passed)
  const targetedFails = verification.levels.targeted.filter(r => !r.passed)
  const regressionFails = verification.levels.regression.filter(r => !r.passed)

  if (staticFails.some(f => f.name === "build" || f.name === "typecheck")) return "build"
  if (targetedFails.length > 0) return "test"
  if (regressionFails.length > 0) return "test"

  return "incomplete"
}

/**
 * Parse build failure output through the diagnostic classifier.
 * If known patterns are found, produce diagnostic-specific repair instructions.
 * Otherwise, fall back to generic build failure instructions.
 */
function buildDiagnosticAwareInstructions(
  _failureType: RepairFailureType,
  failures: string[],
  verification: VerificationResult
): string {
  const allDetails = verification.levels.static
    .filter(r => !r.passed && r.details)
    .map(r => r.details!)

  const diagnosticInputs = parseBuildOutputIntoDiagnostics(allDetails)
  const classified = classifyDiagnostics(diagnosticInputs)

  if (classified.length > 0) {
    const instructions = buildBatchRepairInstructions(classified)
    return [
      "[CAR REPAIR: BUILD FAILURE — DIAGNOSTIC INTELLIGENCE ACTIVE]",
      `Found ${classified.length} classified diagnostic(s). Follow the repair playbooks below.`,
      "",
      instructions,
    ].join("\n")
  }

  return [
    "[CAR REPAIR: BUILD FAILURE]",
    "The build or typecheck failed. Re-read the error output below and fix the syntax/type issue.",
    `Failures: ${failures.join("; ")}`,
    "Do NOT restart the task. Fix only the build error, then re-verify.",
  ].join("\n")
}

/**
 * Extract individual diagnostic-like entries from build/typecheck output.
 * Looks for lines matching common error formats: file:line:col: message
 */
function parseBuildOutputIntoDiagnostics(
  outputs: string[]
): Array<{ message: string; file: string; line: number; column?: number }> {
  const results: Array<{ message: string; file: string; line: number; column?: number }> = []
  const linePattern = /^(.+?):(\d+):(\d+)[\s:-]+(.+)$/

  for (const output of outputs) {
    for (const line of output.split("\n")) {
      const trimmed = line.trim()
      const match = trimmed.match(linePattern)
      if (match) {
        results.push({
          file: match[1]!,
          line: parseInt(match[2]!, 10),
          column: parseInt(match[3]!, 10),
          message: match[4]!.trim(),
        })
      }
    }
  }

  return results
}

function buildRepairInstructions(failureType: RepairFailureType, verification: VerificationResult): string {
  const failures = verification.remaining_failures

  switch (failureType) {
    case "build":
      return buildDiagnosticAwareInstructions(failureType, failures, verification)

    case "test":
      return [
        "[CAR REPAIR: TEST FAILURE]",
        "One or more tests failed. Re-read the test output and fix the logic error.",
        `Failures: ${failures.join("; ")}`,
        "Do NOT change test assertions unless the test expectation is genuinely wrong.",
      ].join("\n")

    case "retrieval":
      return [
        "[CAR REPAIR: WRONG FILE AREA]",
        "The changes were made to the wrong files or the context was insufficient.",
        "Re-read the task intent and acceptance criteria. Identify the correct files.",
        "Do NOT continue editing the wrong area.",
      ].join("\n")

    case "drift":
      return [
        "[CAR REPAIR: CONTEXT DRIFT]",
        "The task has drifted from the original intent. Re-anchor to acceptance criteria.",
        `Remaining criteria: ${failures.join("; ")}`,
        "Focus only on satisfying the remaining acceptance criteria.",
      ].join("\n")

    case "incomplete":
      return [
        "[CAR REPAIR: INCOMPLETE]",
        "The task is partially done. Continue from where you left off.",
        `Remaining: ${failures.join("; ")}`,
        "Do NOT restart. Continue from the current state.",
      ].join("\n")
  }
}

/**
 * Attempt a structured repair loop.
 * Returns the repair instructions to inject, or null if max repairs exhausted.
 */
export function attemptRepair(
  sessionID: string,
  verification: VerificationResult
): { instructions: string; failureType: RepairFailureType } | null {
  const record = taskStateMachine.getTask(sessionID)
  if (!record) return null

  const failureType = classifyFailure(verification)
  const transitioned = requestTransition(sessionID, "REPAIRING")

  if (!transitioned) {
    log(`[CARRepairManager] Repair loop exhausted for session ${sessionID}. Transitioning to BLOCKED.`)
    requestTransition(sessionID, "BLOCKED")
    taskStateMachine.setBlockedReason(
      sessionID,
      `Max repair loops exhausted. Last failure: ${failureType}`,
      verification.remaining_failures
    )
    return null
  }

  const repairData: Omit<RepairRecord, "attempt" | "timestamp"> = {
    failure_type: failureType,
    failure_evidence: verification.remaining_failures.join("; "),
    action_taken: `Classified as ${failureType}, injecting repair instructions`,
  }
  taskStateMachine.recordRepair(sessionID, repairData)

  const instructions = buildRepairInstructions(failureType, verification)
  log(`[CARRepairManager] Repair attempt ${record.repair_loop_count}: ${failureType}`)

  return { instructions, failureType }
}
