import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "../types"
import { getAgentRequirement, isAnyFallbackModelAvailable } from "../../shared"
import { createHeidiAgent } from "../heidi"
import { applyEnvironmentContext } from "./environment-context"
import { applyCategoryOverride, mergeAgentConfig } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import type { OhMyOpenCodeConfig } from "../../config"

export function maybeCreateHeidiConfig(input: {
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

  if (disabledAgents.some((name) => name.toLowerCase() === "heidi")) return undefined

  const heidiOverride = agentOverrides["heidi"]
  const heidiRequirement = getAgentRequirement(pluginConfig, "heidi")
  const hasHeidiExplicitConfig = heidiOverride !== undefined

  const meetsAnyModelRequirement =
    !heidiRequirement?.requiresAnyModel ||
    hasHeidiExplicitConfig ||
    isFirstRunNoCache ||
    isAnyFallbackModelAvailable(heidiRequirement.fallbackChain, availableModels)

  if (!meetsAnyModelRequirement) return undefined

  let heidiResolution = applyModelResolution({
    uiSelectedModel: heidiOverride?.model ? undefined : uiSelectedModel,
    sessionModel: heidiOverride?.model ? undefined : sessionModel,
    userModel: heidiOverride?.model,
    requirement: heidiRequirement,
    availableModels,
    systemDefaultModel,
    contextID: "heidi",
  })

  if (isFirstRunNoCache && !heidiOverride?.model && !uiSelectedModel) {
    heidiResolution = getFirstFallbackModel(heidiRequirement)
  }

  if (!heidiResolution) return undefined
  const { model: heidiModel, variant: heidiResolvedVariant } = heidiResolution

  let heidiConfig = createHeidiAgent(
    heidiModel,
    availableAgents,
    undefined,
    availableSkills,
    availableCategories,
    useTaskSystem,
  )

  if (heidiResolvedVariant) {
    heidiConfig = { ...heidiConfig, variant: heidiResolvedVariant }
  }

  const heidiOverrideCategory = (heidiOverride as Record<string, unknown> | undefined)?.category as string | undefined
  if (heidiOverrideCategory) {
    heidiConfig = applyCategoryOverride(heidiConfig, heidiOverrideCategory, mergedCategories)
  }

  heidiConfig = applyEnvironmentContext(heidiConfig, directory, { disableOmoEnv })

  if (heidiOverride) {
    heidiConfig = mergeAgentConfig(heidiConfig, heidiOverride, directory)
  }

  return heidiConfig
}