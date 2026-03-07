import { storeToolMetadata } from "../features/tool-metadata-store";
import { createFailureResult } from "./safety-tool-result";

/**
 * Wraps a safety-critical tool's execute function to ensure it ALWAYS
 * returns valid metadata, even if the underlying logic throws an error
 * or returns early. This prevents the runtime `[Tool Contract Violation]`
 * from being triggered by malformed tool returns.
 * 
 * It ensures metadata is stored for hook retrieval and flattens nested metadata,
 * but no longer auto-fills success/verified status.
 */
export function withToolContract(
    toolName: string,
    executeFn: (args: any, context: any) => Promise<string>
): (args: any, context: any) => Promise<string> {
    const safetyCriticalTools = ["git_safe", "fs_safe", "verify_action", "submit_plan", "mark_step_complete", "unlock_plan", "query_ledger", "complete_task", "report_issue_verification"];

    return async (args, context) => {
        let metadataCalled = false;
        let lastMetadata: any = null;

        // Intercept metadata calls to ensure they are flattened and stored
        const originalMetadata = context.metadata.bind(context);
        context.metadata = (data: any) => {
            metadataCalled = true;
            let flattened = data;
            if (data && typeof data === 'object') {
                // 1. Flatten nested metadata
                if (data.metadata && typeof data.metadata === 'object') {
                    const { metadata, ...rest } = data;
                    flattened = { ...rest, ...metadata };
                }

                // 2. [REMOVED] Strong guarantee for success/verified
                // We no longer auto-fill these to force developer correctness.
                // Safety-critical tools MUST explicitly report their status.
            }
            
            lastMetadata = flattened;

            // 3. Centralized storage for retrieval by hooks (e.g. tool.execute.after)
            if (context.callID) {
                const pendingData = {
                    title: flattened.title || toolName,
                    metadata: flattened
                };
                storeToolMetadata(context.sessionID, context.callID, pendingData);
            }
            
            return originalMetadata(flattened);
        };

        let executionMessage: string
        try {
            executionMessage = await executeFn(args, context)

            // 4. [REMOVED] Final Hard Guarantee
            // We no longer inject success if the tool failed to call metadata.
            // This ensures that missing metadata is caught as a contract violation (if applicable).
        } catch (error: any) {
            const result = createFailureResult(`Exception in ${toolName}: ${error.message}`)
            const meta = {
                title: `${toolName} failed`,
                ...result,
                success: false,
                verified: false
            }
            context.metadata(meta)

            // Return the failure text so the LLM sees it
            return result.message || error.message
        }
        return executionMessage
    }
}
