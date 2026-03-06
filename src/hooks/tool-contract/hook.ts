import type { PluginInput } from "@opencode-ai/plugin"

/**
 * Strict Tool Contract Enforcement
 * 
 * Intercepts tool execution outputs and strictly enforces the ToolResult contract.
 * If a tool claims success = false, or if it claims a state change occurred but 
 * the contract is violated, we throw an error.
 */

export function createToolContractHook(_ctx: PluginInput) {
    return {
        "tool.execute.after": async (
            input: { tool: string; sessionID: string; callID: string },
            output: { args: any; result: string; metadata?: any }
        ) => {
            // Apply strict contract enforcement to our core safety tools
            if (input.tool === "git_safe" || input.tool === "fs_safe" || input.tool === "verify_action") {
                const meta = output.metadata || {}

                if (meta.success === undefined && meta.verified === undefined) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return structured metadata. Missing 'success' or 'verified' flag. Execution rejected.`)
                }

                if (meta.success === false || meta.verified === false) {
                    throw new Error(`[Tool Contract Enforcer] Tool execution explicitly failed. You MUST revise your plan. Output: ${output.result}`)
                }

                if (input.tool !== "verify_action" && meta.changedState === undefined) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return the required 'changedState' boolean.`)
                }
            }
        }
    }
}
