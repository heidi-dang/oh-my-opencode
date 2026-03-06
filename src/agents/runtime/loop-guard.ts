import { createHash } from "crypto"
import { compiler } from "../../runtime/plan-compiler"

/**
 * Loop Guard
 * 
 * Prevents infinite fail-retry cycles and deep recursion.
 * Uses semantic fingerprinting to detect loops even if state slightly shifts.
 */

const MAX_AGENT_DEPTH = 4
const MAX_AGENT_CALLS = 12
const MAX_TOOL_CALLS = 30

export const buildLoopGuardSection = (depth: number, agentCalls: number, toolCalls: number) => {
    if (depth > MAX_AGENT_DEPTH || agentCalls > MAX_AGENT_CALLS || toolCalls > MAX_TOOL_CALLS) {
        throw new Error(`[Loop Guard] Execution limits exceeded (Depth: ${depth}/${MAX_AGENT_DEPTH}, AgentCalls: ${agentCalls}/${MAX_AGENT_CALLS}, ToolCalls: ${toolCalls}/${MAX_TOOL_CALLS}). Aborting.`);
    }

    return `## Loop Guard Status
- Current Depth: ${depth}/${MAX_AGENT_DEPTH}
- Agent Calls: ${agentCalls}/${MAX_AGENT_CALLS}
- Tool Calls: ${toolCalls}/${MAX_TOOL_CALLS}`
}

export function detectLoop(history: any[], currentGoal: string, actionType: string) {
    if (history.length < 3) return false

    const activeStepId = compiler.getActiveStep()?.id || "no-active-step"

    // Hash includes Plan Step + Goal + ActionType
    const currentFingerprint = createHash("sha256")
        .update(`${activeStepId}:${currentGoal}:${actionType}`)
        .digest("hex")

    const lastHashes = history.slice(-3).map(h => {
        return createHash("sha256")
            .update(`${h.stepId || 'unknown'}:${h.goal || ''}:${h.actionType || ''}`)
            .digest("hex")
    })

    const isLoop = lastHashes.every(h => h === currentFingerprint)
    if (isLoop) {
        throw new Error(`[Loop Guard] Semantic loop detected for action ${actionType} at step ${activeStepId}. Execution halted.`)
    }

    return false
}
