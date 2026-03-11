/**
 * User-Facing Status — Barrel export.
 *
 * Provides the presentation layer that maps internal CAR/runtime states
 * to friendly, truthful wording for chat UI and toast notifications.
 */

export type {
  ToneMode,
  StatusCategory,
  StatusEvent,
  StatusContext,
  FormattedStatus,
} from "./types"

export {
  formatStatus,
  formatStateTransition,
  formatToolResult,
  formatRecoveryEvent,
  formatVerificationResult,
  formatBlockedCondition,
  formatCompletion,
} from "./formatter"

export {
  STATE_MESSAGES,
  EVENT_MESSAGES,
  TOOL_MESSAGES,
  RECOVERY_MESSAGES,
  VERIFICATION_MESSAGES,
  BLOCKED_MESSAGES,
  COMPLETION_MESSAGES,
} from "./messages"
