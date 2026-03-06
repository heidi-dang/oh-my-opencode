import { AgentLogger } from "./agent-logger"
// Note: In OhMyOpencode, tooling is handled via the hook system.
// This prototype represents the strict execution contract requested by the Token-Efficient Architecture.

export interface AgentAction {
    type: "tool" | "delegate" | "report"
    tool?: string
    args?: Record<string, any>
    agent?: string
    task?: string
    message?: string
}

export const ToolRunner = {
    /**
     * Strict wrapper ensuring all tool calls go through the verification subsystem
     * and never rely on raw shell evaluation by the LLM.
     */
    runTool: async (action: AgentAction): Promise<any> => {
        if (action.type !== "tool" || !action.tool) {
            throw new Error("Invalid tool action format");
        }

        AgentLogger.logToolCall(action.tool, action.args || {})

        // Route to strict implementations
        if (action.tool === "git_safe" || action.tool === "fs_safe") {
            // In a real implementation we would dynamically invoke the tool() wrapper
            // Currently handled natively via @opencode-ai/sdk tool routing
            const simulatedResult = {
                tool: action.tool,
                success: true,
                changedState: true,
                stdout: "Operation executed (prototype implementation)",
                stderr: ""
            }
            AgentLogger.logToolResult(true, simulatedResult.stdout)
            return simulatedResult
        }

        throw new Error(`[Tool Runner] Unknown or unauthorized tool: ${action.tool}`)
    }
}
