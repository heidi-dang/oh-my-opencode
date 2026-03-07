import { storeToolMetadata } from "../features/tool-metadata-store";
import { createFailureResult } from "./safety-tool-result";

/**
 * Wraps a safety-critical tool's execute function to ensure it ALWAYS
 * returns valid metadata, even if the underlying logic throws an error
 * or returns early. This prevents the runtime `[Tool Contract Violation]`
 * from being triggered by malformed tool returns.
 */
export function withToolContract(
    toolName: string,
    executeFn: (args: any, context: any) => Promise<string>
): (args: any, context: any) => Promise<string> {
    return async (args, context) => {
        // Intercept metadata calls to ensure they are flattened and stored
        const originalMetadata = context.metadata.bind(context);
        context.metadata = (data: any) => {
            let flattened = data;
            if (data && typeof data === 'object') {
                // If it has a metadata nested object, flatten it
                if (data.metadata && typeof data.metadata === 'object') {
                    const { metadata, ...rest } = data;
                    flattened = { ...rest, ...metadata };
                }
            }
            
            // Centralized storage for the tool.execute.after hook
            if (context.callID) {
                const pendingData = {
                    title: flattened.title,
                    metadata: flattened // We put EVERYTHING in metadata to ensure it's merged back by the hook
                };
                storeToolMetadata(context.sessionID, context.callID, pendingData);
            }
            
            return originalMetadata(flattened);
        };

        let executionMessage: string
        try {
            executionMessage = await executeFn(args, context)
        } catch (error: any) {
            const result = createFailureResult(`Exception in ${toolName}: ${error.message}`)
            const meta = {
                title: `${toolName} failed`,
                ...result
            }
            context.metadata(meta)

            // Return the failure text so the LLM sees it
            return result.message || error.message
        }
        return executionMessage
    }
}
