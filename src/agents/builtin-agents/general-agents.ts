import type { AgentConfig } from "@opencode-ai/sdk"
import type { BuiltinAgentName, AgentOverrides, AgentPromptMetadata } from "../types"
import type { CategoryConfig, GitMasterConfig } from "../../config/schema"
import type { BrowserAutomationProvider } from "../../config/schema"
import type { AvailableAgent } from "../types";
import { getAgentRequirement, isModelAvailable } from "../../shared"
import { buildAgent, isFactory } from "../agent-builder"
import { applyOverrides } from "./agent-overrides"
import { applyEnvironmentContext } from "./environment-context"
import { applyModelResolution } from "./model-resolution"
import type { OhMyOpenCodeConfig } from "../../config"

export function collectPendingBuiltinAgents(input: {
  agentSources: Record<BuiltinAgentName, import("../agent-builder").AgentSource>
  agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>>
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  directory?: string
  systemDefaultModel?: string
  mergedCategories: Record<string, CategoryConfig>
  gitMasterConfig?: GitMasterConfig
  browserProvider?: BrowserAutomationProvider
  uiSelectedModel?: string
  sessionModel?: string
  availableModels: Set<string>
  disabledSkills?: Set<string>
  useTaskSystem?: boolean
  disableOmoEnv?: boolean
  pluginConfig: OhMyOpenCodeConfig
}): { pendingAgentConfigs: Map<string, AgentConfig>; availableAgents: AvailableAgent[] } {
  const {
    agentSources,
    agentMetadata,
    disabledAgents,
    agentOverrides,
    directory,
    systemDefaultModel,
    mergedCategories,
    gitMasterConfig,
    browserProvider,
    uiSelectedModel,
    sessionModel,
    availableModels,
    disabledSkills,
    disableOmoEnv = false,
    pluginConfig,
  } = input

  const availableAgents: AvailableAgent[] = []
  const pendingAgentConfigs: Map<string, AgentConfig> = new Map()

  for (const [name, source] of Object.entries(agentSources)) {
    const agentName = name as BuiltinAgentName

    if (agentName === "sisyphus") continue
    if (agentName === "hephaestus") continue
    if (agentName === "atlas") continue
    if (disabledAgents.some((name) => name.toLowerCase() === agentName.toLowerCase())) continue

    const override = agentOverrides[agentName]
      ?? Object.entries(agentOverrides).find(([key]) => key.toLowerCase() === agentName.toLowerCase())?.[1]
    const requirement = getAgentRequirement(pluginConfig, agentName)

    // Check if agent requires a specific model
    if (requirement?.requiresModel && availableModels) {
      if (!isModelAvailable(requirement.requiresModel, availableModels)) {
        continue
      }
    }

    const isPrimaryAgent = isFactory(source) && source.mode === "primary"

    const resolution = applyModelResolution({
      uiSelectedModel: ((isPrimaryAgent || agentName === "chat") && !override?.model) ? uiSelectedModel : undefined,
      sessionModel: ((isPrimaryAgent || agentName === "chat") && !override?.model) ? sessionModel : undefined,
      userModel: override?.model,
      requirement,
      availableModels,
      systemDefaultModel,
      contextID: agentName,
    })
    if (!resolution) continue
    const { model, variant: resolvedVariant } = resolution

    let config = buildAgent(source, model, mergedCategories, gitMasterConfig, browserProvider, disabledSkills)

    // Apply resolved variant from model fallback chain
    if (resolvedVariant) {
      config = { ...config, variant: resolvedVariant }
    }

    if (agentName === "librarian") {
      config = applyEnvironmentContext(config, directory, { disableOmoEnv })
    }

    config = applyOverrides(config, override, mergedCategories, directory)

    // Store for later - will be added after sisyphus and hephaestus
    pendingAgentConfigs.set(name, config)

    const metadata = agentMetadata[agentName]
    if (metadata) {
      availableAgents.push({
        name: agentName,
        description: config.description ?? "",
        metadata,
      })
    }
  }

  return { pendingAgentConfigs, availableAgents }
}
