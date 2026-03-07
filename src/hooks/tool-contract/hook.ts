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
            output: { title: string; output: string; metadata: any }
        ) => {
            const result = output.output
            const args = output.metadata?.args
            // Apply strict contract enforcement to our core safety tools
            const safetyCritical = ["git_safe", "fs_safe", "verify_action", "complete_task"]
            if (safetyCritical.includes(input.tool)) {
                // The tool might return metadata directly in output, or nested in output.metadata
                // or even in output.result (based on some past patterns)
                let meta = output.metadata || {}

                // If there's no success/verified at top level of metadata, check if it's nested
                // but the goal is to have it FLAT now.

                const getBool = (val: any) => {
                    if (typeof val === 'boolean') return val;
                    if (val === 'true') return true;
                    if (val === 'false') return false;
                    return undefined;
                }

                const success = getBool(meta.success);
                const verified = getBool(meta.verified);

                // 1. Enforce existence and type of standard result contract
                if (success === undefined || verified === undefined) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return structured boolean metadata for 'success' or 'verified'. Execution rejected. Found: ${JSON.stringify(meta)}`)
                }

                // 2. Strict Deterministic Rejection
                if (success === false) {
                    throw new Error(`[Tool Contract Enforcer] Tool execution explicitly failed in ${input.tool}. You MUST revise your plan. Error: ${result}`)
                }

                // 3. Verification Enforcement
                if (verified === false) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} executed but was NOT verified. Hallucination risk! Aborting for safety.`)
                }

                // 4. Metadata Integrity (ChangedState)
                const changedState = getBool(meta.changedState);
                if (input.tool !== "verify_action" && changedState === undefined) {
                    throw new Error(`[Tool Contract Violation] Tool ${input.tool} did not return the required 'changedState' boolean.`)
                }

                // 5. Ledger Relation Evidence Requirements
                if (changedState === true) {
                    if (!meta.stateChange) {
                        throw new Error(`[Tool Contract Violation] Tool ${input.tool} claimed a state change but provided no 'stateChange' payload to link to the State Ledger.`)
                    }

                    // Delay slightly in case execution-journal runs concurrently
                    await new Promise(resolve => setTimeout(resolve, 50))

                    const payload = meta.stateChange
                    const actuallyInLedger = ledger.has(payload.type, (e) =>
                        e.key === payload.key &&
                        e.sessionID === input.sessionID &&
                        e.success === true &&
                        e.verified === true &&
                        e.changedState === true
                    )

                    if (!actuallyInLedger) {
                        throw new Error(`[Tool Contract Violation] Tool ${input.tool} reported state change for ${payload.type}:${payload.key}, but no matching SUCCESSFUL and VERIFIED entry was found in the State Ledger for the current session.`)
                    }
                }
            }
        }
    }
}
