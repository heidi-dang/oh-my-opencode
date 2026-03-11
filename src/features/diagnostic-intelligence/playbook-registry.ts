/**
 * Playbook Registry — Ranked repair strategies and decision trees
 * for each diagnostic class.
 *
 * Each playbook defines:
 *   - strategy_priority: ordered from strongest (root-cause) to weakest
 *   - inspection_steps: what to check before applying a fix
 *   - anti_patterns: what to avoid
 *   - decision_tree: condition → strategy mapping
 *   - verification_command: how to confirm the fix worked
 */

import type { RepairPlaybook, DiagnosticClass } from "./types"

const PLAYBOOKS: Map<DiagnosticClass, RepairPlaybook> = new Map()

// ────────────────────────────────────────────
// Python: Optional null attribute access
// ────────────────────────────────────────────

PLAYBOOKS.set("python.optional-null-attribute", {
  class: "python.optional-null-attribute",
  strategy_priority: ["guard-fail-fast", "contract-fix", "assertion", "conditional-access"],
  inspection_steps: [
    "Find where the variable is assigned (trace upstream)",
    "Check the function return type annotation",
    "Check if there is already a guard in the nearby control flow",
    "Determine if the object is required for continued execution or genuinely optional",
    "Check if the loader/factory function should never return None on success path",
  ],
  anti_patterns: [
    "Do NOT blindly add 'if x is not None' everywhere",
    "Do NOT cast to Any or use type: ignore",
    "Do NOT suppress the diagnostic without narrowing",
    "Do NOT add assertions without verifying upstream logic guarantees non-None",
  ],
  decision_tree: [
    {
      condition: "The object is required for the code path to be valid",
      strategy: "guard-fail-fast",
      rationale: "Add explicit guard + raise/return early. The code cannot function without this object.",
    },
    {
      condition: "The upstream function should never return None on the success path",
      strategy: "contract-fix",
      rationale: "Fix the function contract: raise on failure instead of returning None. This is the root-cause fix.",
    },
    {
      condition: "A runtime invariant already guarantees the object is not None",
      strategy: "assertion",
      rationale: "Add an assert to make the invariant explicit to the type checker.",
    },
    {
      condition: "None is a genuinely valid business case",
      strategy: "conditional-access",
      rationale: "Add a conditional branch with explicit fallback behavior.",
    },
  ],
  verification_command: "pyright {file} || mypy {file}",
})

// ────────────────────────────────────────────
// Python: Optional null subscript
// ────────────────────────────────────────────

PLAYBOOKS.set("python.optional-null-subscript", {
  class: "python.optional-null-subscript",
  strategy_priority: ["guard-fail-fast", "contract-fix", "assertion", "conditional-access"],
  inspection_steps: [
    "Find where the subscripted variable is assigned",
    "Check if the variable can legitimately be None at this point",
    "Check upstream function return type",
    "Determine if subscript access is safe after a guard",
  ],
  anti_patterns: [
    "Do NOT suppress with type: ignore",
    "Do NOT wrap in try/except without addressing root cause",
    "Do NOT change the variable type to Any",
  ],
  decision_tree: [
    {
      condition: "The variable must be a container for the code to work",
      strategy: "guard-fail-fast",
      rationale: "Add guard + raise/return. If it's None, subsequent logic is invalid.",
    },
    {
      condition: "The function producing this value should guarantee a container",
      strategy: "contract-fix",
      rationale: "Fix the upstream function contract to raise instead of returning None.",
    },
    {
      condition: "Runtime invariant guarantees non-None",
      strategy: "assertion",
      rationale: "Narrow the type with an explicit assertion.",
    },
    {
      condition: "None is acceptable and should skip the subscript operation",
      strategy: "conditional-access",
      rationale: "Wrap in a conditional with explicit fallback.",
    },
  ],
  verification_command: "pyright {file} || mypy {file}",
})

// ────────────────────────────────────────────
// Python: Possibly unbound
// ────────────────────────────────────────────

PLAYBOOKS.set("python.possibly-unbound", {
  class: "python.possibly-unbound",
  strategy_priority: ["guard-fail-fast", "type-narrowing"],
  inspection_steps: [
    "Check if the variable is defined in all branches of a conditional",
    "Check if there is a missing else/default assignment",
    "Determine if the variable should have a default value",
  ],
  anti_patterns: [
    "Do NOT suppress the warning",
    "Do NOT initialize to None if the variable must be a specific type",
  ],
  decision_tree: [
    {
      condition: "The variable is only assigned in one branch of an if/else",
      strategy: "guard-fail-fast",
      rationale: "Add the missing assignment in the other branch, or raise/return early.",
    },
    {
      condition: "The variable should have a default value",
      strategy: "type-narrowing",
      rationale: "Initialize the variable before the conditional with an appropriate default.",
    },
  ],
  verification_command: "pyright {file} || mypy {file}",
})

// ────────────────────────────────────────────
// Python: Import error
// ────────────────────────────────────────────

PLAYBOOKS.set("python.import-error", {
  class: "python.import-error",
  strategy_priority: ["import-fix"],
  inspection_steps: [
    "Check if the module exists in the project or is an external dependency",
    "Check if it's a typo in the module name",
    "Check if it's a missing __init__.py",
    "Check requirements.txt / pyproject.toml for missing dependency",
  ],
  anti_patterns: [
    "Do NOT silence with try/except ImportError unless genuinely optional",
    "Do NOT add runtime-only imports to bypass type checking",
  ],
  decision_tree: [
    {
      condition: "Module exists but path is wrong",
      strategy: "import-fix",
      rationale: "Correct the import path.",
    },
    {
      condition: "Module is missing from dependencies",
      strategy: "import-fix",
      rationale: "Add the dependency to requirements/pyproject and install it.",
    },
  ],
  verification_command: "pyright {file} || python -c 'import {symbol}'",
})

// ────────────────────────────────────────────
// TypeScript: Possibly undefined
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.possibly-undefined", {
  class: "typescript.possibly-undefined",
  strategy_priority: ["guard-fail-fast", "type-narrowing", "assertion", "conditional-access"],
  inspection_steps: [
    "Check the variable's type declaration",
    "Trace upstream assignment or function return type",
    "Check if the value comes from an optional property, Map.get, or array access",
    "Determine if undefined is a valid runtime case",
  ],
  anti_patterns: [
    "Do NOT use non-null assertion (!) without verifying the invariant",
    "Do NOT cast to any",
    "Do NOT use @ts-ignore or @ts-expect-error",
  ],
  decision_tree: [
    {
      condition: "The value must exist for the function to work correctly",
      strategy: "guard-fail-fast",
      rationale: "Add explicit check + throw/return early.",
    },
    {
      condition: "The value comes from an optional chain that can be narrowed",
      strategy: "type-narrowing",
      rationale: "Add a type guard or narrowing check.",
    },
    {
      condition: "A runtime invariant guarantees the value exists",
      strategy: "assertion",
      rationale: "Use an assertion or non-null assertion with a comment explaining the invariant.",
    },
    {
      condition: "Undefined is genuinely valid and should be handled",
      strategy: "conditional-access",
      rationale: "Add conditional branch with fallback behavior.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// TypeScript: Nullable property access
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.nullable-property-access", {
  class: "typescript.nullable-property-access",
  strategy_priority: ["guard-fail-fast", "type-narrowing", "conditional-access"],
  inspection_steps: [
    "Check the union type that includes undefined/null",
    "Trace where the object gets its type",
    "Check if a preceding check already narrows the type but TypeScript cannot infer it",
  ],
  anti_patterns: [
    "Do NOT use non-null assertion (!) without documented invariant",
    "Do NOT use as any",
    "Do NOT use @ts-ignore",
  ],
  decision_tree: [
    {
      condition: "The property access is inside a path that requires the object to exist",
      strategy: "guard-fail-fast",
      rationale: "Add a guard that throws or returns before the access.",
    },
    {
      condition: "The type can be narrowed with a typeof or instanceof check",
      strategy: "type-narrowing",
      rationale: "Add a type guard to narrow the union type.",
    },
    {
      condition: "The property access should be conditional on the object existing",
      strategy: "conditional-access",
      rationale: "Use optional chaining (?.) or a conditional branch.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// TypeScript: Missing property
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.missing-property", {
  class: "typescript.missing-property",
  strategy_priority: ["type-annotation-fix", "contract-fix"],
  inspection_steps: [
    "Check the type definition for the object",
    "Determine if the property should exist on the type",
    "Check if it's a typo in the property name",
    "Check if the type needs to be extended",
  ],
  anti_patterns: [
    "Do NOT cast to any",
    "Do NOT use bracket notation to bypass type checking",
  ],
  decision_tree: [
    {
      condition: "The property should exist but the type definition is missing it",
      strategy: "type-annotation-fix",
      rationale: "Add the property to the type definition.",
    },
    {
      condition: "The property name is misspelled",
      strategy: "type-annotation-fix",
      rationale: "Correct the typo.",
    },
    {
      condition: "The function contract should include this property",
      strategy: "contract-fix",
      rationale: "Update the function/interface contract to include the property.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// TypeScript: Type mismatch
// ────────────────────────────────────────────

PLAYBOOKS.set("typescript.type-mismatch", {
  class: "typescript.type-mismatch",
  strategy_priority: ["type-annotation-fix", "contract-fix", "type-narrowing"],
  inspection_steps: [
    "Compare the expected type vs the actual type",
    "Check if the value needs conversion or the type needs widening",
    "Check if the function parameter type is too strict or too loose",
  ],
  anti_patterns: [
    "Do NOT cast with 'as' unless the type relationship is genuinely safe",
    "Do NOT use any to silence the error",
  ],
  decision_tree: [
    {
      condition: "The actual type is a subset or convertible to the expected type",
      strategy: "type-narrowing",
      rationale: "Add proper conversion or narrowing.",
    },
    {
      condition: "The type annotation on the target is wrong",
      strategy: "type-annotation-fix",
      rationale: "Fix the annotation to match the actual valid types.",
    },
    {
      condition: "The function contract needs updating",
      strategy: "contract-fix",
      rationale: "Update the function signature to accept the actual types.",
    },
  ],
  verification_command: "bun run typecheck",
})

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Look up a repair playbook for a given diagnostic class.
 * Returns undefined for unknown classes.
 */
export function getPlaybook(diagnosticClass: DiagnosticClass): RepairPlaybook | undefined {
  return PLAYBOOKS.get(diagnosticClass)
}

/**
 * Check if a playbook exists for a given diagnostic class.
 */
export function hasPlaybook(diagnosticClass: DiagnosticClass): boolean {
  return PLAYBOOKS.has(diagnosticClass)
}

/**
 * Get all registered diagnostic classes that have playbooks.
 */
export function getRegisteredClasses(): DiagnosticClass[] {
  return [...PLAYBOOKS.keys()]
}
