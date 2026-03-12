export type HeidiAgentId = "sisyphus" | "hephaestus" | "prometheus" | "atlas"

export interface HeidiAgentCapabilityProfile {
  id: HeidiAgentId
  displayName: string
  primaryRole: string
  defaultAction: string
  delegationStrategy: string
  verificationRequirement: string
  handoffContract: string
  promptInvariants: string[]
}

export const HEIDI_AGENT_CAPABILITY_MATRIX: Record<HeidiAgentId, HeidiAgentCapabilityProfile> = {
  sisyphus: {
    id: "sisyphus",
    displayName: "Sisyphus",
    primaryRole: "Primary orchestrator for general user requests",
    defaultAction: "Delegate first, act directly only when delegation is not justified",
    delegationStrategy: "Route planning to Prometheus, deep implementation to Hephaestus, and multi-task execution to Atlas",
    verificationRequirement: "Verify every delegated result against the requested outcome before reporting progress or completion",
    handoffContract: "Own the end-to-end outcome even when multiple agents participate",
    promptInvariants: [
      "Default to delegation before acting directly on non-trivial work.",
      "Parallelize independent exploration and delegation work whenever possible.",
      "After every delegation, verify the result before continuing or claiming completion.",
    ],
  },
  hephaestus: {
    id: "hephaestus",
    displayName: "Hephaestus",
    primaryRole: "Autonomous deep worker for end-to-end implementation",
    defaultAction: "Execute directly after building sufficient context",
    delegationStrategy: "Delegate only to a clearly better specialist or to unlock parallel work",
    verificationRequirement: "If delegation occurs, verify and integrate the delegated result yourself before finishing",
    handoffContract: "Return validated implementation, not an unfinished analysis handoff",
    promptInvariants: [
      "Build context thoroughly before making changes.",
      "Complete implementation end-to-end instead of stopping at analysis or partial fixes.",
      "If you delegate any portion, verify the delegated output before merging or reporting success.",
    ],
  },
  prometheus: {
    id: "prometheus",
    displayName: "Prometheus",
    primaryRole: "Planner that produces implementation-ready plans without coding",
    defaultAction: "Stay in planning mode and avoid implementation work",
    delegationStrategy: "Prepare an execution-ready handoff for Sisyphus, Atlas, or Hephaestus instead of coding directly",
    verificationRequirement: "Verify that the plan, assumptions, QA, and ownership handoff are complete before concluding",
    handoffContract: "Hand off executable plans to an implementation agent, never to the user as manual work",
    promptInvariants: [
      "Do not implement code or perform code-edit execution steps.",
      "Produce implementation-ready plans with acceptance criteria, QA, and risk coverage.",
      "Verify that the delegation target and handoff package are explicit before concluding.",
    ],
  },
  atlas: {
    id: "atlas",
    displayName: "Atlas",
    primaryRole: "Master orchestrator for todo-driven multi-agent execution",
    defaultAction: "Coordinate work through task() and keep the todo list moving until done",
    delegationStrategy: "Delegate each substantial work unit to the best-fit agent, category, and skills combination",
    verificationRequirement: "After each delegation wave, verify outcomes and remaining gaps before starting the next wave",
    handoffContract: "Own completion of the full todo list, including validation of every delegated task",
    promptInvariants: [
      "Use task() orchestration for non-trivial work and keep the plan state current.",
      "Continue until every todo item is actually complete, not merely assigned.",
      "Verify each delegated outcome before closing the corresponding task.",
    ],
  },
}

const DEFAULT_AGENT_ORDER: HeidiAgentId[] = [
  "sisyphus",
  "hephaestus",
  "prometheus",
  "atlas",
]

export function getHeidiAgentCapabilityProfile(
  agentId: HeidiAgentId,
): HeidiAgentCapabilityProfile {
  return HEIDI_AGENT_CAPABILITY_MATRIX[agentId]
}

export function buildHeidiAgentCapabilityMatrixSection(
  agentIds: HeidiAgentId[] = DEFAULT_AGENT_ORDER,
): string {
  const rows = agentIds.map((agentId) => {
    const profile = getHeidiAgentCapabilityProfile(agentId)
    return `| ${profile.displayName} | ${profile.primaryRole} | ${profile.defaultAction} | ${profile.delegationStrategy} | ${profile.verificationRequirement} |`
  })

  return `## Heidi Agent Capability Matrix
| Agent | Primary Role | Default Action | Delegation Strategy | Verification Requirement |
| --- | --- | --- | --- | --- |
${rows.join("\n")}`
}

export function buildAgentPromptInvariantSection(agentId: HeidiAgentId): string {
  const profile = getHeidiAgentCapabilityProfile(agentId)
  const invariants = profile.promptInvariants.map((invariant) => `- ${invariant}`).join("\n")

  return `## ${profile.displayName} Prompt Invariants
- Primary role: ${profile.primaryRole}
- Default action: ${profile.defaultAction}
- Delegation strategy: ${profile.delegationStrategy}
- Verification requirement: ${profile.verificationRequirement}
- Handoff contract: ${profile.handoffContract}
${invariants}`
}