import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import { getToolFromRegistry } from "../../runtime/tools/registry"
import { isAbortError } from "./is-abort-error"

export interface AutoExecuteResult {
    success: boolean
    output: string
    metadata?: any
}

/**
 * AutoExecutor
 * 
 * Executes deterministic plan steps directly without LLM involvement by
 * calling the tool's implementation with a synthetic context.
 * 
 * IMPORTANT: This checks for cancellation state before executing to prevent
 * auto-execution from continuing after cancellation.
 */
export async function executeDeterministicStep(
    ctx: PluginInput,
    sessionID: string,
    actionName: string,
    toolArgs?: any
): Promise<AutoExecuteResult> {
    log(`[AutoExecutor] Executing deterministic step: ${actionName}`, { sessionID, toolArgs })

    // Check if session is being cancelled before executing
    try {
        const session = await ctx.client.session.get({ path: { id: sessionID } })
        // Type assertion to handle dynamic session response
        const sessionData = session.data as any
        if (sessionData?.status === "cancelled" || sessionData?.status === "error") {
            log(`[AutoExecutor] Session cancelled, skipping auto-execution`, { sessionID, status: sessionData?.status })
            return {
                success: false,
                output: "Auto-execution skipped: session cancelled"
            }
        }
    } catch (err) {
        // If we can't get session status, check if it's an abort error
        if (isAbortError(err)) {
            log(`[AutoExecutor] Session abort detected, skipping auto-execution`, { sessionID, error: err })
            return {
                success: false,
                output: "Auto-execution skipped: session aborted"
            }
        }
        // For other errors, proceed with caution
        log(`[AutoExecutor] Could not verify session status, proceeding with auto-execution`, { sessionID, error: err })
    }

    try {
        const tool = getToolFromRegistry(actionName)
        if (!tool || typeof tool.execute !== "function") {
            throw new Error(`Tool ${actionName} has no execute function`)
        }

        let capturedMetadata: any = {}

        const syntheticToolContext = {
            directory: ctx.directory,
            sessionID: sessionID,
            client: ctx.client,
            metadata: (data: any) => {
                capturedMetadata = { ...capturedMetadata, ...data }
            }
        }

        const output = await tool.execute(toolArgs || {}, syntheticToolContext)

        const success = capturedMetadata?.success !== false

        log(`[AutoExecutor] Step completed`, { actionName, success })

        return {
            success,
            output: String(output),
            metadata: capturedMetadata
        }
    } catch (err) {
        log(`[AutoExecutor] Step failed`, { actionName, error: String(err) })
        return {
            success: false,
            output: `Auto-Execution Failed: ${String(err)}`
        }
    }
}
