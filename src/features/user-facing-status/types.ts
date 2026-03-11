/**
 * User-Facing Status — Type definitions.
 *
 * Defines the interfaces for the presentation layer that maps
 * internal CAR/runtime states to friendly, truthful wording.
 */

import type { TaskState } from "../controlled-agent-runtime/types"
import type { StallClass } from "../stall-recovery/types"

export type ToneMode = "neutral" | "friendly" | "playful"
export type Severity = "info" | "success" | "warn" | "error"

export type StatusCategory =
  | "state_transition"
  | "event"
  | "tool_result"
  | "recovery_event"
  | "verification_result"
  | "blocked_condition"
  | "completion"

export interface StatusEvent {
  category: StatusCategory
  /** Internal state or event key (e.g. TaskState, StallClass, tool name) */
  key: string
  /** Optional context for richer messages */
  context?: StatusContext
}

export interface StatusContext {
  /** File or path being worked on */
  file?: string
  /** Current repair pass number */
  repairPass?: number
  /** Total repair passes allowed */
  maxRepairPasses?: number
  /** Specific tool that ran */
  toolName?: string
  /** Error or failure reason */
  reason?: string
  /** Agent name that was spawned */
  agentName?: string
  /** Verification method that ran */
  verificationMethod?: string
  /** Duration string for completed tasks */
  duration?: string
}

export interface FormattedStatus {
  /** Primary status line shown to the user */
  headline: string
  /** Optional secondary detail line */
  detail?: string
  /** The final tone used after escalation rules were applied */
  tone_used: ToneMode
  /** The severity of the message for UI styling */
  severity: Severity
}
