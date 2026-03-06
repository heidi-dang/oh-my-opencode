/**
 * Model Policy — Fail-Closed Exact String Matching
 *
 * Validates that user-configured model IDs exactly match known available models.
 * When a configured model is invalid, throws with a clear error showing valid alternatives.
 *
 * Design:
 * - Exact match only (no fuzzy, no prefix search) — "grok-4" != "xai/grok-4"
 * - Falls through gracefully when availableModels cache is empty (first-run)
 * - Applies only to explicit user overrides, not fallback-chain models
 */

/** Max alternatives to show in the error message */
const MAX_ALTERNATIVES_SHOWN = 10

/**
 * Validates a user-configured model ID against the available models set.
 *
 * @throws {Error} When configuredModel is not in availableModels (and the cache is non-empty)
 */
export function validateModelPolicy(
    agentName: string,
    configuredModel: string,
    availableModels: Set<string>
): void {
    // If the cache is empty we're on first-run — skip validation
    if (availableModels.size === 0) return

    if (availableModels.has(configuredModel)) return

    // Build a helpful list of same-provider alternatives
    const providerPrefix = configuredModel.includes("/")
        ? configuredModel.split("/")[0] + "/"
        : ""

    const sameProviderModels = providerPrefix
        ? [...availableModels].filter((m) => m.startsWith(providerPrefix)).sort().slice(0, MAX_ALTERNATIVES_SHOWN)
        : []

    const alternatives =
        sameProviderModels.length > 0
            ? sameProviderModels
            : [...availableModels].sort().slice(0, MAX_ALTERNATIVES_SHOWN)

    const altList = alternatives.join(", ")

    throw new Error(
        `[oh-my-opencode] Agent '${agentName}': configured model '${configuredModel}' is not a valid model ID.\n` +
        `Valid alternatives${providerPrefix ? ` (provider: ${providerPrefix.slice(0, -1)})` : ""}: ${altList}\n` +
        `Run 'opencode models' to see all available models.`
    )
}

/**
 * Safe wrapper — logs a warning instead of throwing when strict=false.
 * Strict mode (default) fails closed.
 */
export function validateModelPolicySafe(
    agentName: string,
    configuredModel: string,
    availableModels: Set<string>,
    strict = true
): { valid: boolean; error?: string } {
    try {
        validateModelPolicy(agentName, configuredModel, availableModels)
        return { valid: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (strict) throw err
        return { valid: false, error: message }
    }
}
