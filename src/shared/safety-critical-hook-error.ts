const SAFETY_CRITICAL_ERROR_PATTERNS = [
  "[Runtime Enforcement Guard]",
  "[Tool Contract Violation]",
  "[Tool Contract Enforcer]",
  "[ERROR] STRICT ISSUE",
  "[ERROR] TASK COMPLETION REJECTED",
  "Hallucination risk!",
]

export function isSafetyCriticalHookError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : ""

  return SAFETY_CRITICAL_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}