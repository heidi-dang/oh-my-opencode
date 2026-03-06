import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoriesConfig, CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "../types";
import { AGENT_MODEL_REQUIREMENTS, isAnyFallbackModelAvailable } from "../../shared"
import { applyEnvironmentContext } from "./environment-context"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { createSisyphusAgent } from "../sisyphus"

import { BuiltinAgentName, AgentFactory } from "../types"

export function maybeCreatePrimaryAgentConfig(input: {
  agentName: BuiltinAgentName
  factory: AgentFactory
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  uiSelectedModel?: string
  availableModels: Set<string>
  systemDefaultModel?: string
  isFirstRunNoCache: boolean
  availableAgents: AvailableAgent[]
  availableSkills: AvailableSkill[]
  availableCategories: AvailableCategory[]
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  userCategories?: CategoriesConfig
  useTaskSystem: boolean
  disableOmoEnv?: boolean
}): AgentConfig | undefined {
  const {
    agentName,
    factory,
    disabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills,
    availableCategories,
    mergedCategories,
    directory,
    useTaskSystem,
    disableOmoEnv = false,
  } = input

  const override = agentOverrides[agentName]
  const requirement = AGENT_MODEL_REQUIREMENTS[agentName]
  const hasExplicitConfig = override !== undefined
  const meetsAnyModelRequirement =
    !requirement?.requiresAnyModel ||
    hasExplicitConfig ||
    isFirstRunNoCache ||
    isAnyFallbackModelAvailable(requirement.fallbackChain, availableModels)

  if (disabledAgents.includes(agentName) || !meetsAnyModelRequirement) return undefined

  let resolution = applyModelResolution({
    uiSelectedModel: override?.model ? undefined : uiSelectedModel,
    userModel: override?.model,
    requirement: requirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !override?.model && !uiSelectedModel) {
    resolution = getFirstFallbackModel(requirement)
  }

  if (!resolution) return undefined
  const { model, variant: resolvedVariant } = resolution

  // For Master agent, we use a simpler factory that only takes model
  // For Sisyphus, it takes many more arguments.
  let config: AgentConfig;
  if (agentName === "sisyphus") {
    config = (factory as any)(
      model,
      availableAgents,
      undefined,
      availableSkills,
      availableCategories,
      useTaskSystem
    )
  } else {
    config = factory(model)
  }

  if (resolvedVariant) {
    config = { ...config, variant: resolvedVariant }
  }

  config = applyOverrides(config, override, mergedCategories, directory)
  config = applyEnvironmentContext(config, directory, {
    disableOmoEnv,
  })

  return config
}
