/**
 * Plan Quality Gate — Validates plans before execution.
 *
 * Rejects vague plans and ensures every step maps to a concrete action.
 * Plans must have: file targets, tool actions, OR verification actions.
 * "I will investigate and fix the issue" = rejected.
 */

import { log } from "../../shared/logger"
import type { TaskPlan, PlanStep } from "./types"

export interface PlanValidationResult {
  valid: boolean
  rejection_reasons: string[]
  warnings: string[]
  hints: string[]
}

const MIN_STEPS = 2
const VAGUE_PATTERNS = [
  /^i will (?:investigate|look into|check|try)/i,
  /^(?:fix|update|improve|change) (?:it|this|that|the issue)/i,
  /^(?:let me|i'll) (?:see|figure out|work on)/i,
]

export function validatePlan(plan: TaskPlan): PlanValidationResult {
  const reasons: string[] = []
  const warnings: string[] = []
  const hints: string[] = []

  // Rule 1: Minimum step count
  if (plan.steps.length < MIN_STEPS) {
    reasons.push(`Plan has ${plan.steps.length} steps, minimum is ${MIN_STEPS}.`)
    hints.push("Please expand your plan to include at least 2 concrete steps (e.g., one for the fix, one for verification).")
  }

  // Rule 2: Every step must map to a file, tool, or verification action
  for (const step of plan.steps) {
    if (!step.target_type || !step.target_value) {
      reasons.push(`Step "${step.id}" has no target_type or target_value. Every step must map to a file, tool, or verification action.`)
      hints.push(`Ensure step "${step.id}" specifies WHAT it is acting on (a file path or a tool name).`)
    }

    // Check for vague descriptions
    for (const pattern of VAGUE_PATTERNS) {
      if (pattern.test(step.description)) {
        reasons.push(`Step "${step.id}" has a vague description: "${step.description}". Be concrete about what will change.`)
        hints.push(`Be more specific in step "${step.id}". Instead of "fix it", say "update function X in Y.ts to handle Z".`)
        break
      }
    }
  }

  // Rule 3: Must have at least one verification step
  const hasVerification = plan.steps.some(s => s.target_type === "verification")
  if (!hasVerification && plan.verification_commands.length === 0) {
    reasons.push("Plan has no verification steps or commands. At least one verification action is required.")
    hints.push("Add a verification step or command (e.g., 'bun test' or a specific verification tool call) to confirm your changes.")
  }

  // Rule 4: Bugfix plans should have a hypothesis
  if (!plan.hypothesis) {
    warnings.push("Plan has no root cause hypothesis. Recommended for bugfix tasks.")
    hints.push("Providing a hypothesis helps me validate your logic. Why do you think this bug exists?")
  }

  // Rule 5: Destructive changes should have rollback path
  const hasDestructiveSteps = plan.steps.some(s =>
    s.description.toLowerCase().includes("delete") ||
    s.description.toLowerCase().includes("remove") ||
    s.description.toLowerCase().includes("refactor")
  )
  if (hasDestructiveSteps && !plan.rollback_path) {
    warnings.push("Plan includes destructive changes but has no rollback path.")
    hints.push("Since you are performing destructive changes, please specify a rollback path (e.g., use 'git stash' or a backup).")
  }

  const valid = reasons.length === 0

  if (valid) {
    log(`[PlanQualityGate] Plan APPROVED: ${plan.steps.length} steps, ${plan.verification_commands.length} verification commands`)
  } else {
    log(`[PlanQualityGate] Plan REJECTED: ${reasons.length} reasons`)
  }

  return { valid, rejection_reasons: reasons, warnings, hints }
}

/**
 * Quick helper: create a well-formed plan step.
 */
export function createPlanStep(
  id: string,
  description: string,
  targetType: PlanStep["target_type"],
  targetValue: string,
  verificationCommand?: string
): PlanStep {
  return { id, description, target_type: targetType, target_value: targetValue, verification_command: verificationCommand }
}
