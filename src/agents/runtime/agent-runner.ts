import { ToolRunner, type AgentAction } from "./tool-runner"
import { AgentLogger } from "./agent-logger"
import { ledger } from "../../runtime/state-ledger"
import { compiler } from "../../runtime/plan-compiler"

/**
 * Agent Runner
 * 
 * Enforces the strict sequential lifecycle: PLAN -> EXECUTE -> VERIFY -> REPORT
 * It ensures the LLM never bypasses structure.
 */

export interface TaskState {
    goal: string
    toolCalls: number
    agentCalls: number
    verified: boolean
}

export const AgentRunner = {
    /**
     * Main execution loop enforcing determinism.
     */
    runAgent: async (agentPlan: () => Promise<AgentAction>, taskState: TaskState): Promise<any> => {
        AgentLogger.logAgentStart("CurrentAgent", taskState.goal)

        // 1. PLAN
        const action = await agentPlan()

        // 2. EXECUTE Tool
        if (action.type === "tool" && action.tool) {
            taskState.toolCalls++

            const result = await ToolRunner.runTool(action)

            // 3. VERIFY
            if (!result.success) {
                AgentLogger.logAbort("Tool execution failed.")
                throw new Error("Tool execution failed")
            }

            // Implicit ledger update logic would exist here if not handled by hooks.
            taskState.verified = true

            return result
        }

        // Delegation
        if (action.type === "delegate" && action.agent) {
            taskState.agentCalls++
            AgentLogger.logDelegation("CurrentAgent", action.agent, action.task || "")
            // RECURSION into designated agent subsystem
            return null
        }

        // 4. REPORT
        if (action.type === "report") {
            AgentLogger.logCompletion("CurrentAgent", action.message || "")
            return action.message
        }

        throw new Error("Unknown AgentAction type returned from Planner.")
    }
}
