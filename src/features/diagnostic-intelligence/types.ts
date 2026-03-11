/**
 * Diagnostic Intelligence Types — Foundation type system for classifying,
 * routing, and repairing static analysis errors.
 *
 * Truth ownership:
 *   - DiagnosticClassifier owns classification
 *   - PlaybookRegistry owns repair strategy selection
 *   - SignatureMemory owns cross-session pattern storage
 *   - RepairInstructionsBuilder owns agent-facing instruction format
 */

// ────────────────────────────────────────────
// Diagnostic Classification
// ────────────────────────────────────────────

export type DiagnosticLanguage = "python" | "typescript" | "unknown"

export type DiagnosticSeverity = "error" | "warning" | "info"

/**
 * Normalized diagnostic class that groups related static analysis errors
 * into a single repairable category.
 */
export type DiagnosticClass =
  | "python.optional-null-attribute"
  | "python.optional-null-subscript"
  | "python.possibly-unbound"
  | "python.import-error"
  | "python.type-mismatch"
  | "typescript.possibly-undefined"
  | "typescript.nullable-property-access"
  | "typescript.missing-property"
  | "typescript.type-mismatch"
  | "typescript.import-error"
  | "unknown"

/**
 * A raw diagnostic message after classification.
 * Extracts the meaningful parts from the raw LSP/editor message.
 */
export interface ClassifiedDiagnostic {
  class: DiagnosticClass
  language: DiagnosticLanguage
  symbol: string
  attribute?: string
  file: string
  line: number
  column?: number
  raw_message: string
  severity: DiagnosticSeverity
  source?: string
}

// ────────────────────────────────────────────
// Repair Strategies
// ────────────────────────────────────────────

/**
 * Ordered set of repair approaches.
 * These are ranked from strongest (root-cause) to weakest (symptom patch).
 */
export type RepairStrategy =
  | "guard-fail-fast"
  | "contract-fix"
  | "assertion"
  | "type-narrowing"
  | "conditional-access"
  | "import-fix"
  | "type-annotation-fix"

/**
 * A playbook defines how to repair a specific diagnostic class.
 * Includes ranked strategies, inspection steps, and anti-patterns.
 */
export interface RepairPlaybook {
  class: DiagnosticClass
  strategy_priority: RepairStrategy[]
  inspection_steps: string[]
  anti_patterns: string[]
  verification_command: string
  decision_tree: DecisionNode[]
}

/**
 * A decision node in the repair decision tree.
 * Heidi evaluates conditions top-to-bottom and uses the first matching strategy.
 */
export interface DecisionNode {
  condition: string
  strategy: RepairStrategy
  rationale: string
}

// ────────────────────────────────────────────
// Signature Memory (cross-session)
// ────────────────────────────────────────────

/**
 * A reusable repair signature stored to disk.
 * Allows Heidi to recognize and reuse validated fix patterns.
 */
export interface RepairSignature {
  signature: DiagnosticClass
  diagnostic_examples: string[]
  repair_order: string[]
  anti_patterns: string[]
  last_seen: number
  success_count: number
  failure_count: number
}

// ────────────────────────────────────────────
// Repair Output (agent-facing)
// ────────────────────────────────────────────

/**
 * Structured repair instructions injected into the agent's context.
 */
export interface DiagnosticRepairInstructions {
  diagnostic_class: DiagnosticClass
  language: DiagnosticLanguage
  file: string
  line: number
  symbol: string
  attribute?: string
  raw_message: string
  inspection_steps: string[]
  strategy_priority: RepairStrategy[]
  anti_patterns: string[]
  decision_tree: DecisionNode[]
  verification_command: string
}
