/**
 * Task Interpreter — Transforms raw user prompts into structured intent.
 *
 * This prevents the agent from guessing what the user wants.
 * The structured intent anchors all downstream stages (retrieval, planning, verification).
 */

import type { TaskIntent, AcceptanceCriterion, TaskType, RollbackPolicy } from "./types"
import { log } from "../../shared/logger"

const BUGFIX_SIGNALS = [
  "fix", "bug", "broken", "error", "crash", "failing", "not working",
  "regression", "issue", "wrong", "incorrect", "unexpected",
]

const FEATURE_SIGNALS = [
  "add", "create", "implement", "new", "build", "introduce", "support",
]

const REFACTOR_SIGNALS = [
  "refactor", "clean", "improve", "restructure", "reorganize", "simplify", "extract",
]

const CONFIG_SIGNALS = [
  "config", "setting", "env", "schema", "option", "parameter", "flag",
]

const RESEARCH_SIGNALS = [
  "explain", "how does", "what is", "why", "investigate", "look into", "analyze",
  "compare", "understand", "document",
]

function detectTaskType(prompt: string): TaskType {
  const lower = prompt.toLowerCase()

  if (BUGFIX_SIGNALS.some(s => lower.includes(s))) return "bugfix"
  if (FEATURE_SIGNALS.some(s => lower.includes(s))) return "feature"
  if (REFACTOR_SIGNALS.some(s => lower.includes(s))) return "refactor"
  if (CONFIG_SIGNALS.some(s => lower.includes(s))) return "config"
  if (RESEARCH_SIGNALS.some(s => lower.includes(s))) return "research"
  return "unknown"
}

function detectLikelyAreas(prompt: string): string[] {
  const areas: string[] = []

  const filePattern = /(?:src|lib|packages)\/[\w\-./]+\.(?:ts|tsx|js|jsx|json|md)/g
  const matches = prompt.match(filePattern)
  if (matches) {
    areas.push(...matches)
  }

  const dirPattern = /(?:src|lib|packages)\/[\w\-./]+\//g
  const dirMatches = prompt.match(dirPattern)
  if (dirMatches) {
    areas.push(...dirMatches.map(d => d.replace(/\/$/, "")))
  }

  return [...new Set(areas)]
}

function detectClarificationNeeded(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  const vaguePatterns = [
    /^(?:fix|improve|update)\s+(?:it|this|that)$/,
    /^make\s+(?:it|this)\s+(?:better|work|good)$/,
  ]

  if (prompt.trim().split(/\s+/).length < 4) return true
  return vaguePatterns.some(p => p.test(lower.trim()))
}

function detectRollbackPolicy(taskType: TaskType): RollbackPolicy {
  switch (taskType) {
    case "research":
      return "noop"
    case "config":
      return "lightweight"
    case "refactor":
      return "full"
    default:
      return "lightweight"
  }
}

function generateDefaultAcceptanceCriteria(taskType: TaskType): AcceptanceCriterion[] {
  const base: AcceptanceCriterion[] = [
    { id: "typecheck", description: "TypeScript typecheck passes", verification_method: "build", verification_command: "bun run typecheck" },
    { id: "build", description: "Project builds successfully", verification_method: "build", verification_command: "bun run build" },
  ]

  switch (taskType) {
    case "bugfix":
      return [
        ...base,
        { id: "repro_before", description: "Bug reproduced before fix", verification_method: "test" },
        { id: "fix_applied", description: "Fix correctly applied", verification_method: "manual" },
        { id: "repro_after", description: "Bug no longer reproduces after fix", verification_method: "test" },
        { id: "no_regression", description: "No regressions introduced", verification_method: "test", verification_command: "bun test" },
      ]
    case "feature":
      return [
        ...base,
        { id: "feature_implemented", description: "Feature works as specified", verification_method: "manual" },
        { id: "tests_added", description: "Tests added for new feature", verification_method: "test" },
        { id: "no_regression", description: "Existing tests still pass", verification_method: "test", verification_command: "bun test" },
      ]
    case "refactor":
      return [
        ...base,
        { id: "behavior_preserved", description: "Behavior unchanged after refactor", verification_method: "test", verification_command: "bun test" },
        { id: "no_regression", description: "All tests pass", verification_method: "test", verification_command: "bun test" },
      ]
    case "research":
      return [] // No build/test criteria for research tasks
    default:
      return base
  }
}

export function interpretTask(userPrompt: string): TaskIntent {
  const taskType = detectTaskType(userPrompt)
  const likelyAreas = detectLikelyAreas(userPrompt)
  const needsClarification = detectClarificationNeeded(userPrompt)
  const acceptanceCriteria = generateDefaultAcceptanceCriteria(taskType)
  const rollbackPolicy = detectRollbackPolicy(taskType)

  const intent: TaskIntent = {
    goal: userPrompt.trim(),
    constraints: [],
    acceptance_criteria: acceptanceCriteria,
    likely_areas: likelyAreas,
    task_type: taskType,
    needs_clarification: needsClarification,
    clarification_questions: needsClarification ? ["Could you provide more details about what you'd like me to do?"] : undefined,
    forbidden_assumptions: [],
    rollback_policy: rollbackPolicy,
  }

  log(`[TaskInterpreter] Interpreted task: type=${taskType}, areas=${likelyAreas.length}, rollback=${rollbackPolicy}, clarification=${needsClarification}`)
  return intent
}
