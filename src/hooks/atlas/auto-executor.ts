import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import { getToolFromRegistry } from "../../runtime/tools/registry"

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
 */
export async function executeDeterministicStep(
    ctx: PluginInput,
    sessionID: string,
    actionName: string,
    toolArgs?: any
): Promise<AutoExecuteResult> {
    log(`[AutoExecutor] Executing deterministic step: ${actionName}`, { sessionID, toolArgs })

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
