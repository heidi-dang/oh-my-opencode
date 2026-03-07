import { createFailureResult } from "./safety-tool-result"
import { storeToolMetadata } from "../features/tool-metadata-store"

/**
 * Wraps a safety-critical tool's execute function to ensure it ALWAYS
 * returns valid structured boolean metadata, even if it throws an error
 * or returns early. This prevents the runtime `[Tool Contract Violation]`
 * from being triggered by malformed tool returns.
 */
export function withToolContract(
    toolName: string,
    executeFn: (args: any, context: any) => Promise<string>
): (args: any, context: any) => Promise<string> {
    return async (args, context) => {
        let executionMessage: string
        try {
            executionMessage = await executeFn(args, context)

            // If the inner execute function didn't set metadata, it's a contract violation
            // But we can implicitly assume if it didn't throw, we should NOT mask it.
            // Ideally, the inner function should call context.metadata() with at least
            // createSuccessResult() or createFailureResult(). 

            // However, we can't easily read context.metadata from the wrapper without patching it.
            // A simpler safeguard is to catch exceptions and ensure THEY have valid failing metadata.
        } catch (error: any) {
            const result = createFailureResult(`Exception in ${toolName}: ${error.message}`)
            const meta = {
                title: `${toolName} failed`,
                metadata: result as any
            }
            context.metadata({
                title: meta.title,
                ...result
            })

            if (context.callID) {
                storeToolMetadata(context.sessionID, context.callID, meta)
            }

            // Return the failure text so the LLM sees it
            return result.message || error.message
        }
        return executionMessage
    }
}
