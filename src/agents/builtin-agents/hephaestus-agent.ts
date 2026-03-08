import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "../types";
import { getAgentRequirement, isAnyFallbackModelAvailable, log } from "../../shared"
import { createHephaestusAgent } from "../hephaestus"
import { applyEnvironmentContext } from "./environment-context"
import { applyCategoryOverride, mergeAgentConfig } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import type { OhMyOpenCodeConfig } from "../../config"

export function maybeCreateHephaestusConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  availableModels: Set<string>
  systemDefaultModel?: string
  uiSelectedModel?: string
  sessionModel?: string
  isFirstRunNoCache: boolean
  availableAgents: AvailableAgent[]
  availableSkills: AvailableSkill[]
  availableCategories: AvailableCategory[]
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  useTaskSystem: boolean
  disableOmoEnv?: boolean
  pluginConfig: OhMyOpenCodeConfig
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    uiSelectedModel,
    sessionModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills,
    availableCategories,
    mergedCategories,
    directory,
    useTaskSystem,
    disableOmoEnv = false,
    pluginConfig,
  } = input

  if (disabledAgents.includes("hephaestus")) return undefined

  // ... (rest of the code will be updated in next chunk)

  if (disabledAgents.includes("hephaestus")) return undefined

  const hephaestusOverride = agentOverrides["hephaestus"]
  const hephaestusRequirement = getAgentRequirement(pluginConfig, "hephaestus")
  const hasHephaestusExplicitConfig = hephaestusOverride !== undefined

  const meetsAnyModelRequirement =
    !hephaestusRequirement?.requiresAnyModel ||
    hasHephaestusExplicitConfig ||
    isFirstRunNoCache ||
    isAnyFallbackModelAvailable(hephaestusRequirement.fallbackChain, availableModels)

  if (!meetsAnyModelRequirement) return undefined

  // Dev logging to trace config -> resolver path [oh-my-opencode-heidi]
  log("[hephaestus-agent] Resolving model", {
    agentName: "hephaestus",
    pluginConfigModel: hephaestusOverride?.model,
    hephaestusOverrideModel: hephaestusOverride?.model,
    uiSelectedModel,
    sessionModel,
    isFirstRunNoCache,
  })

  let hephaestusResolution = applyModelResolution({
    uiSelectedModel: hephaestusOverride?.model ? undefined : uiSelectedModel,
    sessionModel: hephaestusOverride?.model ? undefined : sessionModel,
    userModel: hephaestusOverride?.model,
    requirement: hephaestusRequirement,
    availableModels,
    systemDefaultModel,
    contextID: "hephaestus",
  })

  log("[hephaestus-agent] Resolved model", {
    agentName: "hephaestus",
    finalResolvedModel: hephaestusResolution?.model,
    provenance: hephaestusResolution?.provenance,
  })

  if (isFirstRunNoCache && !hephaestusOverride?.model) {
    hephaestusResolution = getFirstFallbackModel(hephaestusRequirement)
  }

  if (!hephaestusResolution) return undefined
  const { model: hephaestusModel, variant: hephaestusResolvedVariant } = hephaestusResolution

  let hephaestusConfig = createHephaestusAgent(
    hephaestusModel,
    availableAgents,
    undefined,
    availableSkills,
    availableCategories,
    useTaskSystem
  )

  hephaestusConfig = { ...hephaestusConfig, variant: hephaestusResolvedVariant ?? "medium" }

  const hepOverrideCategory = (hephaestusOverride as Record<string, unknown> | undefined)?.category as string | undefined
  if (hepOverrideCategory) {
    hephaestusConfig = applyCategoryOverride(hephaestusConfig, hepOverrideCategory, mergedCategories)
  }

  hephaestusConfig = applyEnvironmentContext(hephaestusConfig, directory, { disableOmoEnv })

  if (hephaestusOverride) {
    hephaestusConfig = mergeAgentConfig(hephaestusConfig, hephaestusOverride, directory)
  }
  return hephaestusConfig
}
