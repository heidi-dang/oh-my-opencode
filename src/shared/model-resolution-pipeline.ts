import { log } from "./logger"
import * as connectedProvidersCache from "./connected-providers-cache"
import { fuzzyMatchModel } from "./model-availability"
import type { FallbackEntry } from "./model-requirements"
import { transformModelForProvider } from "./provider-model-id-transform"
import { normalizeModel } from "./model-normalization"

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


export function resolveModelPipeline(
  request: ModelResolutionRequest,
): ModelResolutionResult | undefined {
  const attempted: string[] = []
  const { intent, constraints, policy } = request
  const availableModels = constraints.availableModels
  const fallbackChain = policy?.fallbackChain
  const systemDefaultModel = policy?.systemDefaultModel

  const tryResolve = (model?: string, provenance: ModelResolutionProvenance = "override"): ModelResolutionResult | undefined => {
    const normalized = normalizeModel(model)
    if (!normalized) return undefined

    attempted.push(normalized)

    if (availableModels.size > 0) {
      const parts = normalized.split("/")
      const providerHint = parts.length >= 2 ? [parts[0]] : undefined
      const match = fuzzyMatchModel(normalized, availableModels, providerHint)
      if (match) {
        log(`[MODEL-RESOLUTION] Resolved via ${provenance}`, { requested: normalized, resolved: match })
        return { model: match, provenance, attempted }
      }
      log(`[MODEL-RESOLUTION] Requested model not available in current providers`, { requested: normalized, provenance })
      return undefined
    } else {
      log(`[MODEL-RESOLUTION] Resolved via ${provenance} (no availability cache)`, { model: normalized })
      return { model: normalized, provenance, attempted }
    }
  }

  // 1. UI Selection (from Dashboard)
  const uiResult = tryResolve(intent?.uiSelectedModel)
  if (uiResult) return uiResult

  // 2. Local Config Override (e.g. agents.sisyphus.model)
  // userModel MUST take priority over sessionModel
  const userResult = tryResolve(intent?.userModel)
  if (userResult) return userResult

  // 3. Local Config Fallback (e.g. agents.sisyphus.fallback_model)
  const userFallbackResult = tryResolve(intent?.userFallbackModel, "user-fallback")
  if (userFallbackResult) return userFallbackResult

  // 4. Session Inheritance
  const sessionResult = tryResolve(intent?.sessionModel)
  if (sessionResult) return sessionResult

  // 5. Category Defaults (from oh-my-opencode.json categories section)
  const categoryResult = tryResolve(intent?.categoryDefaultModel, "category-default")
  if (categoryResult) return categoryResult

  const categoryFallbackResult = tryResolve(intent?.categoryFallbackModel, "category-default")
  if (categoryFallbackResult) return categoryFallbackResult

  // 6. User-defined secondary fallback list (fallback_models array)
  const userFallbackModels = intent?.userFallbackModels
  if (userFallbackModels && userFallbackModels.length > 0) {
    for (const model of userFallbackModels) {
      const res = tryResolve(model, "user-fallback")
      if (res) return res
    }
  }

  // 7. Hardcoded Fallback Chain (PROVIDER-BASED)
  // This is the LAST RESORT before system default.
  // It only maps high-level intents (e.g. "gpt-5") to provider-specific IDs.
  if (fallbackChain && fallbackChain.length > 0) {
    if (availableModels.size === 0) {
      const connectedProviders = constraints.connectedProviders ?? connectedProvidersCache.readConnectedProvidersCache()
      const connectedSet = connectedProviders ? new Set(connectedProviders) : null

      if (connectedSet !== null) {
        for (const entry of fallbackChain) {
          for (const provider of entry.providers) {
            if (connectedSet.has(provider)) {
              const transformedModelId = transformModelForProvider(provider, entry.model)
              const model = `${provider}/${transformedModelId}`
              log("[MODEL-RESOLUTION] Resolved via provider-specific fallback chain (no cache)", {
                provider,
                model: transformedModelId,
              })
              return {
                model,
                provenance: "provider-fallback",
                variant: entry.variant,
                attempted,
              }
            }
          }
        }
      }
    } else {
      for (const entry of fallbackChain) {
        for (const provider of entry.providers) {
          const fullModel = `${provider}/${entry.model}`
          const match = fuzzyMatchModel(fullModel, availableModels, [provider])
          if (match) {
            log("[MODEL-RESOLUTION] Resolved via provider-specific fallback chain", {
              provider,
              model: entry.model,
              match,
            })
            return {
              model: match,
              provenance: "provider-fallback",
              variant: entry.variant,
              attempted,
            }
          }
        }
      }
    }
  }

  // 8. Global System Default (from oh-my-opencode.json)
  const systemDefaultResult = tryResolve(systemDefaultModel, "system-default")
  if (systemDefaultResult) return systemDefaultResult

  const systemDefaultFallbackResult = tryResolve(policy?.systemDefaultFallbackModel, "system-default")
  if (systemDefaultFallbackResult) return systemDefaultFallbackResult

  log("[MODEL-RESOLUTION] FAILED to resolve any supported model", { attempted })
  return undefined
}
