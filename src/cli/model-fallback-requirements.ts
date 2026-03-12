import type { ModelRequirement } from "../shared/model-requirements"

// NOTE: These requirements are used by the CLI config generator (`generateModelConfig`).
// They intentionally use "install-time" provider IDs (anthropic/openai/google/opencode/etc),
// not runtime-only providers like `nvidia`.
// IMPORTANT: GitHub Copilot only supports a limited set of models:
// - gpt-4o (main model)
// - gpt-4o-mini (fast/cheap model)
// Do NOT add models like gpt-5.x, claude-opus-4-6, etc. as they don't exist in Copilot

export const CLI_AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["opencode"], model: "glm-4.7-free" },
    ],
    requiresAnyModel: true,
  },
  hephaestus: {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-4o", variant: "medium" },
      { providers: ["github-copilot"], model: "gpt-4o-mini", variant: "medium" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
    ],
    requiresAnyModel: true,
  },
  oracle: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
    ],
  },
  librarian: {
    fallbackChain: [
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["opencode"], model: "glm-4.7-free" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5" },
    ],
  },
  explore: {
    fallbackChain: [
      { providers: ["github-copilot"], model: "gpt-4o-mini" },
      { providers: ["anthropic", "opencode"], model: "claude-haiku-4-5" },
      { providers: ["opencode"], model: "gpt-4o-mini" },
    ],
  },
  "multimodal-looker": {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-4o", variant: "medium" },
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-flash" },
      { providers: ["zai-coding-plan"], model: "glm-4.6v" },
      { providers: ["opencode"], model: "gpt-4o-mini" },
    ],
  },
  prometheus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro" },
    ],
  },
  metis: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
    ],
  },
  momus: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o", variant: "medium" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
    ],
  },
  atlas: {
    fallbackChain: [
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro" },
    ],
  },
}

export const CLI_CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  "visual-engineering": {
    fallbackChain: [
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
      { providers: ["zai-coding-plan"], model: "glm-5" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["kimi-for-coding"], model: "k2p5" },
    ],
  },
  ultrabrain: {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-4o", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
    ],
  },
  deep: {
    fallbackChain: [
      { providers: ["openai", "opencode"], model: "gpt-4o", variant: "medium" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
    ],
  },
  artistry: {
    fallbackChain: [
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o" },
    ],
    requiresModel: "gemini-1.5-pro",
  },
  quick: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-haiku-4-5" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-flash" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o-mini" },
    ],
  },
  "unspecified-low": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o", variant: "medium" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-flash" },
    ],
  },
  "unspecified-high": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-4o", variant: "high" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-pro" },
    ],
  },
  writing: {
    fallbackChain: [
      { providers: ["kimi-for-coding"], model: "k2p5" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-1.5-flash" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-5" },
    ],
  },
}
