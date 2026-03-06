/**
 * *-junior Agent Inheritance
 *
 * Any agent named `<parent>-junior` (e.g., `sisyphus-junior`) automatically
 * inherits the parent's (`sisyphus`) agent override config — including model —
 * unless the junior has an explicit override of its own.
 *
 * Merge precedence (highest → lowest):
 *   1. Junior's own explicit overrides
 *   2. Parent's override (inherited)
 *   3. Built-in defaults
 *
 * Rules:
 * - If the junior explicitly sets `model`, it is NOT overridden by the parent.
 * - Any parent field NOT explicitly set in the junior is inherited.
 * - If neither the parent nor junior has an override, returns undefined.
 */

import type { AgentOverrideConfig, AgentOverrides } from "../types"

const JUNIOR_SUFFIX = "-junior"

/**
 * Derives the parent agent name from a junior agent name.
 * Returns null if the name does not end with "-junior".
 */
export function getParentAgentName(agentName: string): string | null {
    if (!agentName.endsWith(JUNIOR_SUFFIX)) return null
    return agentName.slice(0, -JUNIOR_SUFFIX.length)
}

/**
 * Resolves the effective override for a *-junior agent by merging parent
 * override fields that the junior doesn't explicitly override.
 *
 * The junior's explicit settings always win (junior-first merge).
 */
export function resolveJuniorInheritance(
    agentName: string,
    agentOverrides: AgentOverrides
): AgentOverrideConfig | undefined {
    const juniorOverride = agentOverrides[agentName as keyof AgentOverrides] as AgentOverrideConfig | undefined

    const parentName = getParentAgentName(agentName)
    if (!parentName) return juniorOverride

    const parentOverride = agentOverrides[parentName as keyof AgentOverrides] as AgentOverrideConfig | undefined
    if (!parentOverride) return juniorOverride

    // Junior has explicit model → don't inherit from parent
    const juniorHasModel = (juniorOverride as { model?: string } | undefined)?.model !== undefined

    if (!juniorHasModel && !juniorOverride) {
        // No junior override at all — inherit parent wholesale
        return { ...parentOverride }
    }

    if (!juniorHasModel) {
        // Inherit parent model (and any other parent fields junior didn't set)
        return {
            ...parentOverride,
            ...juniorOverride,
        } as AgentOverrideConfig
    }

    // Junior explicitly set model — only merge other non-model fields from parent
    // where junior hasn't set them
    const { model: _parentModel, ...parentWithoutModel } = parentOverride as AgentOverrideConfig & { model?: string }
    return {
        ...parentWithoutModel,
        ...juniorOverride,
    } as AgentOverrideConfig
}

/**
 * Checks whether the agent name follows the *-junior naming pattern.
 */
export function isJuniorAgent(agentName: string): boolean {
    return agentName.endsWith(JUNIOR_SUFFIX)
}
