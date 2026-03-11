import { log } from "../../shared/logger"

/**
 * xAI Usage Patch Hook
 * 
 * This hook fixes a bug where Input Tokens and Total Cost are displayed as negative 
 * values for xAI/Grok models in the dashboard.
 * 
 * The issue stems from the dashboard UI (pre-compiled) incorrectly subtracting 
 * cache_read tokens from the already-net 'input_tokens' returned by xAI.
 * 
 * This hook corrects the data by adding back the cache_read tokens to the input field,
 * so the final displayed value (tokens.input - tokens.cache.read) is correct.
 */
export function createXaiUsagePatchHook() {
    const eventHandler = async ({ event }: { event: { type: string; properties?: unknown } }) => {
        const props = event.properties as Record<string, unknown> | undefined

        if (event.type === "message.updated") {
            const info = props?.info as {
                role?: string
                providerID?: string
                tokens?: {
                    input: number
                    cache?: { read: number; write: number }
                }
            } | undefined

            if (info?.providerID === "xai" && info.tokens) {
                const cacheRead = info.tokens.cache?.read ?? 0
                if (cacheRead > 0) {
                    log("[xai-usage-patch] Patching input tokens for xAI provider", {
                        originalInput: info.tokens.input,
                        cacheRead: cacheRead,
                        newInput: info.tokens.input + cacheRead
                    })

                    // Modifying the object in-place so subsequent hooks and UI logic 
                    // receive the "Gross" input tokens.
                    info.tokens.input += cacheRead
                }
            }
        }
    }

    return {
        event: eventHandler,
    }
}
