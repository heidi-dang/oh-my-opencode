/**
 * User-Facing Status — Core formatter.
 *
 * Pure function layer: takes internal status events + tone preference
 * and returns polished user-facing wording. Never calls the toast API
 * directly — delivery is owned by TaskToastManager and user-notifier.
 *
 * Rules:
 *   1. Never let friendly wording lie about real state
 *   2. Playful tone auto-escalates to friendly for error/failure states
 *   3. Context injection produces specific messages when context is available
 *   4. Same input always produces same output (deterministic)
 */

import type { ToneMode, StatusEvent, StatusContext, FormattedStatus, StatusCategory, Severity } from "./types"
import {
  STATE_MESSAGES,
  EVENT_MESSAGES,
  TOOL_MESSAGES,
  RECOVERY_MESSAGES,
  VERIFICATION_MESSAGES,
  BLOCKED_MESSAGES,
  COMPLETION_MESSAGES,
} from "./messages"

/** Keys that should never use playful tone (auto-escalate to friendly) */
const ESCALATE_KEYS = new Set([
  "BLOCKED",
  "recovery_failed",
  "unrecoverable_error",
  "max_retries_exceeded",
  "dependency_failure",
  "build_fail",
  "test_fail",
  "lint_fail",
])

/**
 * Select the message table for a given category.
 */
function getMessageTable(category: StatusCategory): Record<string, Record<string, { headline: string, detail?: string, severity: Severity }>> {
  switch (category) {
    case "state_transition":
      return STATE_MESSAGES
    case "event":
      return EVENT_MESSAGES
    case "tool_result":
      return TOOL_MESSAGES
    case "recovery_event":
      return RECOVERY_MESSAGES
    case "verification_result":
      return VERIFICATION_MESSAGES
    case "blocked_condition":
      return BLOCKED_MESSAGES
    case "completion":
      return COMPLETION_MESSAGES
  }
}

/**
 * Resolve the effective tone — playful auto-escalates to friendly
 * for error/failure keys to ensure bad news never sounds jokey.
 */
function resolveTone(tone: ToneMode, key: string): ToneMode {
  if (tone === "playful" && ESCALATE_KEYS.has(key)) {
    return "friendly"
  }
  return tone
}

/**
 * Inject context into a formatted status to produce richer messages.
 */
function injectContext(status: FormattedStatus, context?: StatusContext): FormattedStatus {
  if (!context) return status

  const details: string[] = []

  if (context.file) {
    details.push(`Working on ${context.file}`)
  }

  if (context.repairPass !== undefined) {
    const maxInfo = context.maxRepairPasses ? ` of ${context.maxRepairPasses}` : ""
    details.push(`Repair pass ${context.repairPass}${maxInfo}`)
  }

  if (context.toolName) {
    details.push(`Tool: ${context.toolName}`)
  }

  if (context.reason) {
    details.push(context.reason)
  }

  if (context.agentName) {
    details.push(`Agent: ${context.agentName}`)
  }

  if (context.verificationMethod) {
    details.push(`Method: ${context.verificationMethod}`)
  }

  if (context.duration) {
    details.push(`Duration: ${context.duration}`)
  }

  return {
    headline: status.headline,
    detail: details.length > 0 ? details.join(" · ") : status.detail,
    tone_used: status.tone_used,
    severity: status.severity,
  }
}

/**
 * Format a status event into user-facing wording.
 *
 * @param event - The internal status event to format
 * @param tone - The desired tone mode (defaults to "friendly")
 * @returns A FormattedStatus with headline and optional detail
 */
export function formatStatus(
  event: StatusEvent,
  tone: ToneMode = "friendly"
): FormattedStatus {
  const effectiveTone = resolveTone(tone, event.key)
  const table = getMessageTable(event.category)
  const toneTable = table[effectiveTone] ?? table["friendly"] ?? table["neutral"]

  const baseMessage = toneTable?.[event.key]

  if (!baseMessage) {
    return injectContext(
      { 
        headline: `Status: ${event.key}`,
        tone_used: effectiveTone,
        severity: "info",
      },
      event.context
    )
  }

  return injectContext(
    {
      headline: baseMessage.headline,
      detail: baseMessage.detail,
      tone_used: effectiveTone,
      severity: baseMessage.severity,
    },
    event.context
  )
}

/**
 * Convenience: format a TaskState transition.
 */
export function formatStateTransition(
  state: string,
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "state_transition", key: state, context },
    tone
  )
}

/**
 * Convenience: format an internal event.
 */
export function formatEvent(
  eventKey: string,
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "event", key: eventKey, context },
    tone
  )
}

/**
 * Convenience: format a tool result.
 */
export function formatToolResult(
  result: "success" | "failure" | "timeout",
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "tool_result", key: result, context },
    tone
  )
}

/**
 * Convenience: format a recovery event.
 */
export function formatRecoveryEvent(
  event: string,
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "recovery_event", key: event, context },
    tone
  )
}

/**
 * Convenience: format a verification result.
 */
export function formatVerificationResult(
  result: string,
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "verification_result", key: result, context },
    tone
  )
}

/**
 * Convenience: format a blocked condition.
 */
export function formatBlockedCondition(
  condition: string,
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "blocked_condition", key: condition, context },
    tone
  )
}

/**
 * Convenience: format a completion message.
 */
export function formatCompletion(
  result: string,
  tone: ToneMode = "friendly",
  context?: StatusContext
): FormattedStatus {
  return formatStatus(
    { category: "completion", key: result, context },
    tone
  )
}
