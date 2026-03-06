import { AgentLogger } from "./agent-logger"
import { getToolFromRegistry } from "../../runtime/tools/registry"

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

        // Enforce the centralized tool registry
        try {
            const toolInstance = getToolFromRegistry(action.tool);

            // Execute via the tool instance
            const result = await toolInstance.execute(action.args || {}, {
                // Minimal shim for tool context
                metadata: (meta: any) => AgentLogger.logToolResult(meta.success || meta.verified, JSON.stringify(meta))
            });

            return result;
        } catch (e: any) {
            AgentLogger.logAbort(`Tool execution rejected: ${e.message}`);
            throw e;
        }
    }
}

