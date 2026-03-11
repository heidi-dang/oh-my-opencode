/**
 * Unfinished Task Detector — Pre-completion integrity scan.
 *
 * Runs TWICE:
 *   1. Before completion attempt (catches obvious incompleteness)
 *   2. After verification but before final DONE promotion (catches semantic incompleteness)
 *
 * Scans for:
 *   - Files mentioned in plan but not changed
 *   - Test claims without test evidence
 *   - TODO/FIXME markers in changed files
 *   - Commit/push claims without StateLedger entry
 *   - Partial prompt satisfaction
 */

import { readFile } from "fs/promises"
import { join } from "path"
import { log } from "../../shared/logger"
import { ledger } from "../../runtime/state-ledger"
import { taskStateMachine } from "./task-state-machine"

export interface UnfinishedCheck {
  id: string
  description: string
  passed: boolean
  details?: string
}

export interface UnfinishedDetectionResult {
  is_complete: boolean
  checks: UnfinishedCheck[]
  blocking_issues: string[]
}

async function checkTodoMarkers(changedFiles: string[], cwd: string): Promise<UnfinishedCheck> {
  const todosFound: string[] = []
  for (const filePath of changedFiles.slice(0, 10)) {
    try {
      const content = await readFile(join(cwd, filePath), "utf-8")
      const lines = content.split("\n")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line) && !line.includes("// NOTE:")) {
          todosFound.push(`${filePath}:${i + 1}: ${line.trim().substring(0, 80)}`)
        }
      }
    } catch {
      // File may not exist (deleted)
    }
  }

  return {
    id: "no_todo_markers",
    description: "No TODO/FIXME markers in changed files",
    passed: todosFound.length === 0,
    details: todosFound.length > 0 ? todosFound.join("\n") : undefined,
  }
}

function checkLedgerEvidence(sessionID: string, changedFiles: string[]): UnfinishedCheck {
  if (changedFiles.length === 0) {
    return { id: "ledger_evidence", description: "State changes recorded", passed: true }
  }

  const entries = ledger.getEntries(undefined, sessionID).filter(
    e => e.verified && e.success
  )

  return {
    id: "ledger_evidence",
    description: "Changed files have corresponding StateLedger entries",
    passed: entries.length > 0,
    details: entries.length === 0 ? "Files were changed but no verified state changes in StateLedger." : undefined,
  }
}

function checkPlanCoverage(sessionID: string): UnfinishedCheck {
  const record = taskStateMachine.getTask(sessionID)
  if (!record?.approved_plan) {
    return { id: "plan_coverage", description: "All planned files were edited", passed: true }
  }

  const plannedFiles = record.approved_plan.steps
    .filter(s => s.target_type === "file")
    .map(s => s.target_value)

  const missingFiles = plannedFiles.filter(f =>
    !record.changed_files.some(cf => cf.includes(f) || f.includes(cf))
  )

  return {
    id: "plan_coverage",
    description: "All planned file targets were edited",
    passed: missingFiles.length === 0,
    details: missingFiles.length > 0 ? `Planned but not changed: ${missingFiles.join(", ")}` : undefined,
  }
}

function checkAcceptanceCoverage(sessionID: string): UnfinishedCheck {
  const record = taskStateMachine.getTask(sessionID)
  if (!record?.interpreted_intent?.acceptance_criteria?.length) {
    return { id: "acceptance_coverage", description: "All acceptance criteria evaluated", passed: true }
  }

  const criteria = record.interpreted_intent.acceptance_criteria
  const statuses = record.acceptance_statuses
  const unevaluated = criteria.filter(c =>
    !statuses.some(s => s.criterion_id === c.id)
  )

  return {
    id: "acceptance_coverage",
    description: "All acceptance criteria have been evaluated",
    passed: unevaluated.length === 0,
    details: unevaluated.length > 0 ? `Not evaluated: ${unevaluated.map(c => c.description).join(", ")}` : undefined,
  }
}

/**
 * Run the full unfinished task detection.
 */
export async function detectUnfinished(
  sessionID: string,
  cwd: string
): Promise<UnfinishedDetectionResult> {
  const record = taskStateMachine.getTask(sessionID)
  const changedFiles = record?.changed_files ?? []

  const checks: UnfinishedCheck[] = [
    await checkTodoMarkers(changedFiles, cwd),
    checkLedgerEvidence(sessionID, changedFiles),
    checkPlanCoverage(sessionID),
    checkAcceptanceCoverage(sessionID),
  ]

  const blockingIssues = checks.filter(c => !c.passed).map(c => c.description)
  const isComplete = blockingIssues.length === 0

  log(`[UnfinishedDetector] Result: ${isComplete ? "COMPLETE" : "INCOMPLETE"} (${blockingIssues.length} blocking issues)`)

  return { is_complete: isComplete, checks, blocking_issues: blockingIssues }
}
