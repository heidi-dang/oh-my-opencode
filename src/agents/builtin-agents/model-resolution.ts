import { resolveModelPipeline, modelResolutionTracker } from "../../shared"
import { transformModelForProvider } from "../../shared/provider-model-id-transform"

export function applyModelResolution(input: {
  uiSelectedModel?: string
  sessionModel?: string
  userModel?: string
  requirement?: { fallbackChain?: { providers: string[]; model: string; variant?: string }[] }
  availableModels: Set<string>
  systemDefaultModel?: string
  contextID?: string
}) {
  const { uiSelectedModel, sessionModel, userModel, requirement, availableModels, systemDefaultModel, contextID } = input
  
  const request = {
    intent: { uiSelectedModel, sessionModel, userModel },
    constraints: { availableModels },
    policy: { fallbackChain: requirement?.fallbackChain, systemDefaultModel },
  }

  if (contextID) {
    return modelResolutionTracker.resolve(contextID, request)
  }

  return resolveModelPipeline(request)
}

export function getFirstFallbackModel(requirement?: {
  fallbackChain?: { providers: string[]; model: string; variant?: string }[]
}) {
  const entry = requirement?.fallbackChain?.[0]
  if (!entry || entry.providers.length === 0) return undefined
  const provider = entry.providers[0]
  const transformedModel = transformModelForProvider(provider, entry.model)
  return {
    model: `${provider}/${transformedModel}`,
    provenance: "provider-fallback" as const,
    variant: entry.variant,
  }
}
