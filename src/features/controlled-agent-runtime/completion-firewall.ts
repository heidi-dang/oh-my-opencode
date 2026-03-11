/**
 * Completion Firewall — The ONLY component that can promote a task to DONE.
 *
 * This is the decision engine. complete-task.ts (the tool entrypoint) delegates
 * to this module for the final decision. This module does NOT own truth —
 * it reads from TaskStateMachine, StateLedger, VerificationEngine, and UnfinishedDetector.
 *
 * RULE: Heidi calling complete_task is a REQUEST. This module DECIDES.
 */

import { log } from "../../shared/logger"
import { taskStateMachine } from "./task-state-machine"
import { ledger } from "../../runtime/state-ledger"
import type { AcceptanceStatus, VerificationResult } from "./types"

export interface CompletionDecision {
  approved: boolean
  reason: string
  acceptance_score: { total: number; passed: number }
  missing_criteria: string[]
  verification_summary: string
  ledger_entries: number
}

/**
 * Evaluate whether a task is truly complete.
 *
 * Checks (all must pass):
 * 1. Task state must be VERIFYING
 * 2. All acceptance statuses must pass
 * 3. Latest verification result must be overall_pass
 * 4. StateLedger must have at least one verified entry for this session
 * 5. No remaining failures in verification result
 */
export function evaluateCompletion(sessionID: string): CompletionDecision {
  const record = taskStateMachine.getTask(sessionID)

  if (!record) {
    return rejection("No active CAR task found for this session.")
  }

  // Gate 1: State check
  if (record.lifecycle_state !== "VERIFYING") {
    return rejection(`Task is in ${record.lifecycle_state} state, expected VERIFYING.`)
  }

  // Gate 2: Acceptance criteria
  const criteria = record.interpreted_intent?.acceptance_criteria ?? []
  const statuses = record.acceptance_statuses
  const failedCriteria: string[] = []

  for (const criterion of criteria) {
    const status = statuses.find(s => s.criterion_id === criterion.id)
    if (!status || !status.passed) {
      failedCriteria.push(criterion.description)
    }
  }

  if (failedCriteria.length > 0) {
    return rejection(
      `${failedCriteria.length} acceptance criteria not met.`,
      failedCriteria,
      criteria.length,
      criteria.length - failedCriteria.length
    )
  }

  // Gate 3: Verification result
  const verification = record.latest_verification
  if (!verification) {
    return rejection("No verification result found. Run verification before completing.")
  }

  if (!verification.overall_pass) {
    return rejection(
      `Verification failed. Remaining: ${verification.remaining_failures.join(", ")}`,
      verification.remaining_failures,
      criteria.length,
      criteria.length
    )
  }

  // Gate 4: StateLedger evidence
  const entries = ledger.getEntries(undefined, sessionID).filter(
    e => e.verified === true && e.success === true && e.changedState === true
  )

  if (entries.length === 0 && record.changed_files.length > 0) {
    return rejection("Files were changed but no verified state changes recorded in StateLedger.")
  }

  // All gates passed
  const promoted = taskStateMachine.promoteToDone(sessionID)
  if (!promoted) {
    return rejection("State machine refused DONE promotion (unexpected internal error).")
  }

  log(`[CompletionFirewall] APPROVED completion for session ${sessionID}`)

  return {
    approved: true,
    reason: "All completion gates passed.",
    acceptance_score: { total: criteria.length, passed: criteria.length },
    missing_criteria: [],
    verification_summary: `${verification.levels.static.length} static, ${verification.levels.targeted.length} targeted, ${verification.levels.e2e.length} e2e, ${verification.levels.regression.length} regression checks passed.`,
    ledger_entries: entries.length,
  }
}

function rejection(
  reason: string,
  missing: string[] = [],
  total = 0,
  passed = 0
): CompletionDecision {
  log(`[CompletionFirewall] REJECTED: ${reason}`)
  return {
    approved: false,
    reason,
    acceptance_score: { total, passed },
    missing_criteria: missing,
    verification_summary: "",
    ledger_entries: 0,
  }
}
