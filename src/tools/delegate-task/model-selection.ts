import type { FallbackEntry } from "../../shared/model-requirements"
import { normalizeModel } from "../../shared/model-normalization"
import { fuzzyMatchModel } from "../../shared/model-availability"
import { transformModelForProvider } from "../../shared/provider-model-id-transform"


import { resolveModelWithFallback } from "../../shared/model-resolver"

export function resolveModelForDelegateTask(input: {
  userModel?: string
  userFallbackModel?: string
  categoryDefaultModel?: string
  categoryFallbackModel?: string
  fallbackChain?: FallbackEntry[]
  availableModels: Set<string>
  systemDefaultModel?: string
}): { model: string; variant?: string } | undefined {
  const result = resolveModelWithFallback({
    userModel: input.userModel,
    userFallbackModel: input.userFallbackModel,
    categoryDefaultModel: input.categoryDefaultModel,
    categoryFallbackModel: input.categoryFallbackModel,
    fallbackChain: input.fallbackChain,
    availableModels: input.availableModels,
    systemDefaultModel: input.systemDefaultModel,
  })

  if (!result) return undefined

  return {
    model: result.model,
    variant: result.variant,
  }
}
