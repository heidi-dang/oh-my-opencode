/**
 * Diagnostic Classifier — Normalizes raw LSP/editor diagnostic messages
 * into typed DiagnosticClass values using regex-based pattern matching.
 *
 * Supports: Pyright, Pylance, MyPy, TSC, Biome error patterns.
 */

import type { ClassifiedDiagnostic, DiagnosticClass, DiagnosticLanguage, DiagnosticSeverity } from "./types"

// ────────────────────────────────────────────
// Pattern definitions
// ────────────────────────────────────────────

interface DiagnosticPattern {
  class: DiagnosticClass
  language: DiagnosticLanguage
  pattern: RegExp
  extractSymbol: (match: RegExpMatchArray) => string
  extractAttribute?: (match: RegExpMatchArray) => string | undefined
}

const PATTERNS: DiagnosticPattern[] = [
  // Python: "X" is not a known attribute of "None"
  {
    class: "python.optional-null-attribute",
    language: "python",
    pattern: /"([^"]+)" is not a known attribute of "None"/,
    extractSymbol: () => "unknown",
    extractAttribute: (m) => m[1],
  },
  // Python: Attribute "X" of "Y | None" type
  {
    class: "python.optional-null-attribute",
    language: "python",
    pattern: /Cannot access attribute "([^"]+)" for class "([^"]+) \| None"/,
    extractSymbol: (m) => m[2]!,
    extractAttribute: (m) => m[1],
  },
  // Python: Object of type "None" is not subscriptable
  {
    class: "python.optional-null-subscript",
    language: "python",
    pattern: /Object of type "None" is not subscriptable/,
    extractSymbol: () => "unknown",
  },
  // Python: "X" is possibly unbound
  {
    class: "python.possibly-unbound",
    language: "python",
    pattern: /"([^"]+)" is possibly unbound/,
    extractSymbol: (m) => m[1]!,
  },
  // Python: import errors
  {
    class: "python.import-error",
    language: "python",
    pattern: /Import "([^"]+)" could not be resolved/,
    extractSymbol: (m) => m[1]!,
  },
  // Python: Cannot import name "X" from "Y"
  {
    class: "python.import-error",
    language: "python",
    pattern: /Cannot import name "([^"]+)" from "([^"]+)"/,
    extractSymbol: (m) => m[2]!,
    extractAttribute: (m) => m[1],
  },
  // Python: type mismatch
  {
    class: "python.type-mismatch",
    language: "python",
    pattern: /Argument of type "([^"]+)" cannot be assigned to parameter of type "([^"]+)"/,
    extractSymbol: (m) => m[1]!,
    extractAttribute: (m) => m[2],
  },
  // TypeScript: Object is possibly 'undefined'
  {
    class: "typescript.possibly-undefined",
    language: "typescript",
    pattern: /Object is possibly '(?:undefined|null)'/,
    extractSymbol: () => "unknown",
  },
  // TypeScript: 'X' is possibly 'undefined'
  {
    class: "typescript.possibly-undefined",
    language: "typescript",
    pattern: /'([^']+)' is possibly '(?:undefined|null)'/,
    extractSymbol: (m) => m[1]!,
  },
  // TypeScript: Property 'X' does not exist on type 'Y | undefined'
  {
    class: "typescript.nullable-property-access",
    language: "typescript",
    pattern: /Property '([^']+)' does not exist on type '([^']+) \| (?:undefined|null)'/,
    extractSymbol: (m) => m[2]!,
    extractAttribute: (m) => m[1],
  },
  // TypeScript: Property 'X' does not exist on type 'Y'
  {
    class: "typescript.missing-property",
    language: "typescript",
    pattern: /Property '([^']+)' does not exist on type '([^']+)'/,
    extractSymbol: (m) => m[2]!,
    extractAttribute: (m) => m[1],
  },
  // TypeScript: Type 'X' is not assignable to type 'Y'
  {
    class: "typescript.type-mismatch",
    language: "typescript",
    pattern: /Type '([^']+)' is not assignable to type '([^']+)'/,
    extractSymbol: (m) => m[1]!,
    extractAttribute: (m) => m[2],
  },
  // TypeScript: Cannot find module 'X'
  {
    class: "typescript.import-error",
    language: "typescript",
    pattern: /Cannot find module '([^']+)'/,
    extractSymbol: (m) => m[1]!,
  },
]

// ────────────────────────────────────────────
// Severity mapping
// ────────────────────────────────────────────

function mapSeverity(severity?: number | string): DiagnosticSeverity {
  if (typeof severity === "number") {
    if (severity === 1) return "error"
    if (severity === 2) return "warning"
    return "info"
  }
  if (typeof severity === "string") {
    const lower = severity.toLowerCase()
    if (lower === "error") return "error"
    if (lower === "warning") return "warning"
    return "info"
  }
  return "error"
}

function inferLanguage(filePath: string): DiagnosticLanguage {
  if (filePath.endsWith(".py") || filePath.endsWith(".pyi")) return "python"
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx") || filePath.endsWith(".js") || filePath.endsWith(".jsx")) return "typescript"
  return "unknown"
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Classify a single raw diagnostic message into a typed ClassifiedDiagnostic.
 */
export function classifyDiagnostic(input: {
  message: string
  file: string
  line: number
  column?: number
  severity?: number | string
  source?: string
}): ClassifiedDiagnostic {
  const language = inferLanguage(input.file)

  for (const pattern of PATTERNS) {
    const match = input.message.match(pattern.pattern)
    if (match) {
      return {
        class: pattern.class,
        language: pattern.language !== "unknown" ? pattern.language : language,
        symbol: pattern.extractSymbol(match),
        attribute: pattern.extractAttribute?.(match),
        file: input.file,
        line: input.line,
        column: input.column,
        raw_message: input.message,
        severity: mapSeverity(input.severity),
        source: input.source,
      }
    }
  }

  return {
    class: "unknown",
    language,
    symbol: "unknown",
    file: input.file,
    line: input.line,
    column: input.column,
    raw_message: input.message,
    severity: mapSeverity(input.severity),
    source: input.source,
  }
}

/**
 * Classify multiple diagnostics and return only the ones with known classes.
 * Unknown diagnostics are filtered out unless includeUnknown is true.
 */
export function classifyDiagnostics(
  diagnostics: Array<{
    message: string
    file: string
    line: number
    column?: number
    severity?: number | string
    source?: string
  }>,
  includeUnknown = false
): ClassifiedDiagnostic[] {
  const classified = diagnostics.map(classifyDiagnostic)
  return includeUnknown ? classified : classified.filter(d => d.class !== "unknown")
}

/**
 * Check if a raw message matches any known diagnostic pattern.
 */
export function isKnownDiagnosticPattern(message: string): boolean {
  return PATTERNS.some(p => p.pattern.test(message))
}
