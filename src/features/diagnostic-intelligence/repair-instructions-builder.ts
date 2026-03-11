/**
 * Repair Instructions Builder — Converts a ClassifiedDiagnostic + RepairPlaybook
 * into structured agent-facing instructions that Heidi can consume.
 *
 * These instructions are injected into the CAR repair loop context so Heidi
 * knows exactly what to inspect, what strategies to prefer, and what to avoid.
 */

import type { ClassifiedDiagnostic, DiagnosticRepairInstructions } from "./types"
import { getPlaybook } from "./playbook-registry"

/**
 * Build structured repair instructions for a classified diagnostic.
 * Returns null if no playbook exists for the diagnostic class.
 */
export function buildRepairInstructions(
  diagnostic: ClassifiedDiagnostic
): DiagnosticRepairInstructions | null {
  const playbook = getPlaybook(diagnostic.class)
  if (!playbook) return null

  return {
    diagnostic_class: diagnostic.class,
    language: diagnostic.language,
    file: diagnostic.file,
    line: diagnostic.line,
    symbol: diagnostic.symbol,
    attribute: diagnostic.attribute,
    raw_message: diagnostic.raw_message,
    inspection_steps: playbook.inspection_steps,
    strategy_priority: playbook.strategy_priority,
    anti_patterns: playbook.anti_patterns,
    decision_tree: playbook.decision_tree,
    verification_command: playbook.verification_command
      .replace("{file}", diagnostic.file)
      .replace("{symbol}", diagnostic.symbol),
  }
}

/**
 * Format repair instructions as a human-readable string for injection
 * into the agent's context (messages.transform).
 */
export function formatRepairInstructionsForAgent(
  instructions: DiagnosticRepairInstructions
): string {
  const lines: string[] = []

  lines.push(`[CAR DIAGNOSTIC REPAIR: ${instructions.diagnostic_class}]`)
  lines.push("")
  lines.push(`File: ${instructions.file}:${instructions.line}`)
  lines.push(`Error: ${instructions.raw_message}`)
  lines.push(`Symbol: ${instructions.symbol}${instructions.attribute ? ` → .${instructions.attribute}` : ""}`)
  lines.push("")

  lines.push("BEFORE EDITING, INSPECT:")
  for (const step of instructions.inspection_steps) {
    lines.push(`  - ${step}`)
  }
  lines.push("")

  lines.push("REPAIR DECISION TREE (evaluate top-to-bottom, use first match):")
  for (const node of instructions.decision_tree) {
    lines.push(`  IF: ${node.condition}`)
    lines.push(`  THEN: Use strategy "${node.strategy}" — ${node.rationale}`)
    lines.push("")
  }

  lines.push("STRATEGY PRIORITY: " + instructions.strategy_priority.join(" > "))
  lines.push("")

  lines.push("DO NOT:")
  for (const anti of instructions.anti_patterns) {
    lines.push(`  - ${anti}`)
  }
  lines.push("")

  lines.push(`VERIFY WITH: ${instructions.verification_command}`)
  lines.push("Success = diagnostic removed AND behavior still correct AND no new regressions.")

  return lines.join("\n")
}

/**
 * Build and format repair instructions for multiple diagnostics.
 * Groups by file for cleaner output.
 */
export function buildBatchRepairInstructions(
  diagnostics: ClassifiedDiagnostic[]
): string {
  const instructionSets: DiagnosticRepairInstructions[] = []

  for (const diag of diagnostics) {
    const instructions = buildRepairInstructions(diag)
    if (instructions) {
      instructionSets.push(instructions)
    }
  }

  if (instructionSets.length === 0) {
    return "[CAR DIAGNOSTIC] No known repair playbooks match the current diagnostics."
  }

  const formatted = instructionSets.map(formatRepairInstructionsForAgent)
  return formatted.join("\n\n---\n\n")
}
