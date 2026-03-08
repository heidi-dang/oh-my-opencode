import type { OhMyOpenCodeConfig } from "../config"

export type FallbackEntry = {
  providers: string[]
  model: string
  variant?: string // Entry-specific variant (e.g., GPT→high, Opus→max)
}

export type ModelRequirement = {
  fallbackChain: FallbackEntry[]
  variant?: string // Default variant (used when entry doesn't specify one)
  requiresModel?: string // If set, only activates when this model is available (fuzzy match)
  requiresAnyModel?: boolean // If true, requires at least ONE model in fallbackChain to be available (or empty availability treated as unavailable)
  requiresProvider?: string[] // If set, only activates when any of these providers is connected
}

const DEFAULT_AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["zai-coding-plan", "opencode"], model: "glm-5" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
    requiresAnyModel: true,
  },
  hephaestus: {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-5.3-codex", variant: "medium" },
      { providers: ["opencode"], model: "claude-opus-4-6", variant: "max" },
    ],
    requiresAnyModel: true,
  },
  oracle: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
    ],
  },
  librarian: {
    fallbackChain: [
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "minimax-m2.5-free" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  explore: {
    fallbackChain: [
      { providers: ["github-copilot"], model: "grok-code-fast-1" },
      { providers: ["opencode"], model: "minimax-m2.5-free" },
      { providers: ["anthropic", "opencode"], model: "claude-haiku-4-5" },
      { providers: ["opencode"], model: "gpt-5-nano" },
    ],
  },
  "multimodal-looker": {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-5.3-codex", variant: "medium" },
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3-flash" },
      { providers: ["zai-coding-plan"], model: "glm-4.6v" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5-nano" },
    ],
  },
  prometheus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro" },
    ],
  },
  metis: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
    ],
  },
  momus: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "medium" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
    ],
  },
  atlas: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-6" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2" },
    ],
  },
}

const DEFAULT_CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  "visual-engineering": {
    fallbackChain: [
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
      { providers: ["zai-coding-plan", "opencode"], model: "glm-5" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
    ],
  },
  ultrabrain: {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-5.3-codex", variant: "xhigh" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
    ],
  },
  deep: {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-5.3-codex", variant: "medium" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
    ],
    requiresModel: "gpt-5.3-codex",
  },
  artistry: {
    fallbackChain: [
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2" },
    ],
    requiresModel: "gemini-3.1-pro",
  },
  quick: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-haiku-4-5" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "gpt-5-nano" },
    ],
  },
  "unspecified-low": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-6" },
      { providers: ["openai", "opencode"], model: "gpt-5.3-codex", variant: "medium" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3-flash" },
    ],
  },
  "unspecified-high": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro" },
    ],
  },
  writing: {
    fallbackChain: [
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3-flash" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-6" },
    ],
  },
}

function normalizeFallbackModels(fallbackModels: string | any[] | undefined): FallbackEntry[] | undefined {
  if (!fallbackModels) return undefined
  if (typeof fallbackModels === "string") {
    return [{ providers: [], model: fallbackModels }]
  }
  return fallbackModels.map((entry) => {
    if (typeof entry === "string") {
      return { providers: [], model: entry }
    }
    return {
      providers: entry.providers || [],
      model: entry.model,
      variant: entry.variant,
    }
  })
}

export function getAgentRequirement(config: OhMyOpenCodeConfig, agentName: string): ModelRequirement | undefined {
  const agentOverrides = config.agents as Record<string, any> | undefined
  const override = agentOverrides?.[agentName] 
    ?? Object.entries(agentOverrides || {}).find(([key]) => key.toLowerCase() === agentName.toLowerCase())?.[1]
  
  const defaultRequirement = DEFAULT_AGENT_MODEL_REQUIREMENTS[agentName]

  if (!override && !defaultRequirement) return undefined

  // Merge logic: override fields take precedence
  const fallbackChain = normalizeFallbackModels(override?.fallback_models) ?? defaultRequirement?.fallbackChain ?? []
  
  return {
    fallbackChain,
    variant: override?.variant ?? defaultRequirement?.variant,
    requiresModel: override?.requires_model ?? defaultRequirement?.requiresModel,
    requiresAnyModel: override?.requires_any_model ?? defaultRequirement?.requiresAnyModel,
    requiresProvider: override?.requires_provider ?? defaultRequirement?.requiresProvider,
  }
}

export function getCategoryRequirement(config: OhMyOpenCodeConfig, categoryName: string): ModelRequirement | undefined {
  const categoryOverrides = config.categories
  const override = categoryOverrides?.[categoryName]
  const defaultRequirement = DEFAULT_CATEGORY_MODEL_REQUIREMENTS[categoryName]

  if (!override && !defaultRequirement) return undefined

  const fallbackChain = normalizeFallbackModels(override?.fallback_models) ?? defaultRequirement?.fallbackChain ?? []

  return {
    fallbackChain,
    variant: override?.variant ?? defaultRequirement?.variant,
    requiresModel: override?.requires_model ?? defaultRequirement?.requiresModel,
    requiresAnyModel: override?.requires_any_model ?? defaultRequirement?.requiresAnyModel,
    requiresProvider: override?.requires_provider ?? defaultRequirement?.requiresProvider,
  }
}

/** @deprecated Used strictly for transition - move to getAgentRequirement instead */
export const AGENT_MODEL_REQUIREMENTS = DEFAULT_AGENT_MODEL_REQUIREMENTS
/** @deprecated Used strictly for transition - move to getCategoryRequirement instead */
export const CATEGORY_MODEL_REQUIREMENTS = DEFAULT_CATEGORY_MODEL_REQUIREMENTS
