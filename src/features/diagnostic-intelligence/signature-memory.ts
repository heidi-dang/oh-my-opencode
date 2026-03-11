/**
 * Signature Memory — Cross-session storage for repair signatures.
 *
 * Uses the shared MemoryDB with structured MemoryContextItem categories
 * instead of a separate file-based store. This ensures all memory lives
 * in one place and follows the CAR memory architecture:
 *
 *   Memory Context → owns reusable context patterns ONLY.
 *   TaskStateMachine → owns lifecycle.
 *   StateLedger → owns verified evidence.
 */

import { memoryDB } from "../../shared/memory-db"
import { log } from "../../shared/logger"
import type { RepairSignature, DiagnosticClass } from "./types"

/**
 * Record a successful repair for a diagnostic class into MemoryDB.
 */
export function recordRepairSuccess(
  diagnosticClass: DiagnosticClass,
  exampleMessage: string,
  repo?: string
): void {
  memoryDB.save({
    category: "failure_signature",
    signature: diagnosticClass,
    content: `Successful repair for ${diagnosticClass}: ${exampleMessage}`,
    tags: `diagnostic,repair,success,${diagnosticClass}`,
    repo: repo,
    evidence: [exampleMessage],
    confidence: 0.9,
    last_used_at: Date.now(),
  })

  log(`[SignatureMemory] Recorded successful repair for ${diagnosticClass}`)
}

/**
 * Record a failed repair for a diagnostic class into MemoryDB.
 */
export function recordRepairFailure(
  diagnosticClass: DiagnosticClass,
  exampleMessage: string,
  repo?: string
): void {
  memoryDB.save({
    category: "failure_signature",
    signature: diagnosticClass,
    content: `Failed repair for ${diagnosticClass}: ${exampleMessage}`,
    tags: `diagnostic,repair,failure,${diagnosticClass}`,
    repo: repo,
    evidence: [exampleMessage],
    confidence: 0.3,
    last_used_at: Date.now(),
  })

  log(`[SignatureMemory] Recorded failed repair for ${diagnosticClass}`)
}

/**
 * Query MemoryDB for past repair signatures for a diagnostic class.
 */
export function getSignatures(diagnosticClass: DiagnosticClass, repo?: string) {
  return memoryDB.query({
    category: "failure_signature",
    signature: diagnosticClass,
    repo: repo,
  })
}

/**
 * Store a verification pattern that proved a fix worked.
 */
export function recordVerificationPattern(
  diagnosticClass: DiagnosticClass,
  verificationCommand: string,
  repo?: string
): void {
  memoryDB.save({
    category: "verification_pattern",
    signature: diagnosticClass,
    content: `Verification for ${diagnosticClass}: ${verificationCommand}`,
    tags: `verification,${diagnosticClass}`,
    repo: repo,
    confidence: 0.85,
    last_used_at: Date.now(),
  })
}

/**
 * Store a fix pattern that worked for a diagnostic class.
 */
export function recordFixPattern(
  diagnosticClass: DiagnosticClass,
  fixDescription: string,
  pathScope?: string[],
  repo?: string
): void {
  memoryDB.save({
    category: "fix_pattern",
    signature: diagnosticClass,
    content: fixDescription,
    tags: `fix,${diagnosticClass}`,
    repo: repo,
    path_scope: pathScope,
    confidence: 0.8,
    last_used_at: Date.now(),
  })
}
