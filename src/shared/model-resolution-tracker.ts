import { resolveModelPipeline } from "./model-resolution-pipeline"
import type { ModelResolutionRequest, ModelResolutionResult } from "./model-resolution-types"
import { log } from "./logger"

/**
 * Centrally tracks model resolutions to prevent log spam and ensure consistency.
 * Only logs when the RESOLVED model actually changes.
 */
class ModelResolutionTracker {
  private lastResolved = new Map<string, string>()

  /**
   * Resolves a model using the pipeline and tracks the result.
   * @param contextKey A unique key for the resolution context (e.g. "sessionID:agentName")
   * @param request The resolution request
   */
  public resolve(contextKey: string, request: ModelResolutionRequest): ModelResolutionResult | undefined {
    const result = resolveModelPipeline(request)
    if (!result) return undefined

    const previousVisibleModel = this.lastResolved.get(contextKey)
    const currentModel = result.model

    if (currentModel !== previousVisibleModel) {
      this.lastResolved.set(contextKey, currentModel)
      
      // Only log in development or when explicitly requested
      // We use a prefix to distinguish from raw field logs
      if (process.env.NODE_ENV !== "production") {
        console.log(`[MODEL-RESOLUTION] [${contextKey}] Resolved to: ${currentModel} (via ${result.provenance})`)
      }
      
      log(`Model resolution changed for ${contextKey}`, {
        model: currentModel,
        provenance: result.provenance,
        previous: previousVisibleModel
      })
    }

    return result
  }

  public clear(contextKey: string): void {
    this.lastResolved.delete(contextKey)
  }
}

export const modelResolutionTracker = new ModelResolutionTracker()
