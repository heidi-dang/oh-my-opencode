import type { PluginInput } from "@opencode-ai/plugin"
import { ledger } from "../../runtime/state-ledger"

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

                // 1. Enforce existence and type of standard result contract
                if (typeof meta.success !== 'boolean' || typeof meta.verified !== 'boolean') {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return structured boolean metadata for 'success' or 'verified'. Execution rejected.`)
                }

                // 2. Strict Deterministic Rejection
                if (meta.success === false) {
                    throw new Error(`[Tool Contract Enforcer] Tool execution explicitly failed in ${input.tool}. You MUST revise your plan. Error: ${output.result}`)
                }

                // 3. Verification Enforcement
                if (meta.verified === false) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} executed but was NOT verified. Hallucination risk! Aborting for safety.`)
                }

                // 4. Metadata Integrity (ChangedState)
                if (input.tool !== "verify_action" && typeof meta.changedState !== 'boolean') {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return the required 'changedState' boolean.`)
                }

                // 5. Ledger Relation Evidence Requirements
                if (meta.changedState === true) {
                    if (!meta.stateChange) {
                        throw new Error(`[Tool Contract Violation] Tool ${input.tool} claimed a state change but provided no 'stateChange' payload to link to the State Ledger.`)
                    }

                    // Delay slightly in case execution-journal runs concurrently
                    await new Promise(resolve => setTimeout(resolve, 50))

                    const payload = meta.stateChange
                    const actuallyInLedger = ledger.has(payload.type, payload.key)
                    if (!actuallyInLedger) {
                        throw new Error(`[Tool Contract Violation] Tool ${input.tool} reported state change for ${payload.type}:${payload.key}, but it was not reflected in the State Ledger before completion.`)
                    }
                }
            }
        }
    }
}
