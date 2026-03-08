import type { FallbackEntry } from "./model-requirements"

export type ModelResolutionRequest = {
  intent?: {
    uiSelectedModel?: string
    sessionModel?: string
    userModel?: string
    userFallbackModel?: string
    userFallbackModels?: string[]
    categoryDefaultModel?: string
    categoryFallbackModel?: string
  }
  constraints: {
    availableModels: Set<string>
    connectedProviders?: string[] | null
  }
  policy?: {
    fallbackChain?: FallbackEntry[]
    systemDefaultModel?: string
    systemDefaultFallbackModel?: string
  }
}

export type ModelResolutionProvenance =
  | "override"
  | "category-default"
  | "user-fallback"
  | "provider-fallback"
  | "system-default"

export type ModelResolutionResult = {
  model: string
  provenance: ModelResolutionProvenance
  variant?: string
  attempted?: string[]
  reason?: string
}
