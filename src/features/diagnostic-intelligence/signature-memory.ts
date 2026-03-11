/**
 * Signature Memory — Cross-session storage for repair signatures.
 *
 * Stores validated repair patterns so Heidi can recognize and reuse
 * them across sessions. Tracks success/failure counts for each
 * diagnostic class to improve strategy selection over time.
 */

import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { log } from "../../shared/logger"
import type { RepairSignature, DiagnosticClass } from "./types"

const SIGNATURE_DIR = "state/diagnostic-signatures"
const SIGNATURE_FILE = "signatures.json"

let cachedSignatures: Map<DiagnosticClass, RepairSignature> | null = null

function getSignaturePath(baseDir: string): string {
  return join(baseDir, SIGNATURE_DIR, SIGNATURE_FILE)
}

async function ensureDir(baseDir: string): Promise<void> {
  const dir = join(baseDir, SIGNATURE_DIR)
  await mkdir(dir, { recursive: true })
}

/**
 * Load all repair signatures from disk.
 */
export async function loadSignatures(baseDir: string): Promise<Map<DiagnosticClass, RepairSignature>> {
  if (cachedSignatures) return cachedSignatures

  try {
    const raw = await readFile(getSignaturePath(baseDir), "utf-8")
    const parsed = JSON.parse(raw) as RepairSignature[]
    const map = new Map<DiagnosticClass, RepairSignature>()
    for (const sig of parsed) {
      map.set(sig.signature, sig)
    }
    cachedSignatures = map
    return map
  } catch {
    cachedSignatures = new Map()
    return cachedSignatures
  }
}

/**
 * Save all repair signatures to disk.
 */
export async function saveSignatures(
  baseDir: string,
  signatures: Map<DiagnosticClass, RepairSignature>
): Promise<void> {
  await ensureDir(baseDir)
  const arr = [...signatures.values()]
  await writeFile(getSignaturePath(baseDir), JSON.stringify(arr, null, 2), "utf-8")
  cachedSignatures = signatures
  log(`[SignatureMemory] Saved ${arr.length} repair signatures`)
}

/**
 * Record a successful repair for a diagnostic class.
 */
export async function recordRepairSuccess(
  baseDir: string,
  diagnosticClass: DiagnosticClass,
  exampleMessage: string
): Promise<void> {
  const signatures = await loadSignatures(baseDir)
  const existing = signatures.get(diagnosticClass)

  if (existing) {
    existing.success_count += 1
    existing.last_seen = Date.now()
    if (!existing.diagnostic_examples.includes(exampleMessage)) {
      existing.diagnostic_examples.push(exampleMessage)
    }
  } else {
    signatures.set(diagnosticClass, {
      signature: diagnosticClass,
      diagnostic_examples: [exampleMessage],
      repair_order: [],
      anti_patterns: [],
      last_seen: Date.now(),
      success_count: 1,
      failure_count: 0,
    })
  }

  await saveSignatures(baseDir, signatures)
}

/**
 * Record a failed repair for a diagnostic class.
 */
export async function recordRepairFailure(
  baseDir: string,
  diagnosticClass: DiagnosticClass,
  exampleMessage: string
): Promise<void> {
  const signatures = await loadSignatures(baseDir)
  const existing = signatures.get(diagnosticClass)

  if (existing) {
    existing.failure_count += 1
    existing.last_seen = Date.now()
  } else {
    signatures.set(diagnosticClass, {
      signature: diagnosticClass,
      diagnostic_examples: [exampleMessage],
      repair_order: [],
      anti_patterns: [],
      last_seen: Date.now(),
      success_count: 0,
      failure_count: 1,
    })
  }

  await saveSignatures(baseDir, signatures)
}

/**
 * Get a signature for a diagnostic class if one exists.
 */
export async function getSignature(
  baseDir: string,
  diagnosticClass: DiagnosticClass
): Promise<RepairSignature | undefined> {
  const signatures = await loadSignatures(baseDir)
  return signatures.get(diagnosticClass)
}

/**
 * Clear the in-memory cache. Useful for testing.
 */
export function clearSignatureCache(): void {
  cachedSignatures = null
}
