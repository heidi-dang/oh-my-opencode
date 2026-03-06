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
            const safetyCritical = ["git_safe", "fs_safe", "verify_action", "complete_task"]
            if (safetyCritical.includes(input.tool)) {
                const meta = output.metadata || {}

                // 1. Enforce existence of standard result contract
                if (meta.success === undefined && meta.verified === undefined) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return structured metadata. Missing 'success' or 'verified' flag. Execution rejected.`)
                }

                // 2. Strict Deterministic Rejection
                // If a tool reports success: false, it is an execution failure that should abort.
                if (meta.success === false) {
                    throw new Error(`[Tool Contract Enforcer] Tool execution explicitly failed in ${input.tool}. You MUST revise your plan. Error: ${output.result}`)
                }

                // 3. Verification Enforcement
                // Safety tools MUST be verified.
                if (meta.verified === false) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} executed but was NOT verified. Hallucination risk! Aborting for safety.`)
                }

                // 4. Metadata Integrity (ChangedState)
                if (input.tool !== "verify_action" && meta.changedState === undefined) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return the required 'changedState' boolean.`)
                }
            }

        }
    }
}
