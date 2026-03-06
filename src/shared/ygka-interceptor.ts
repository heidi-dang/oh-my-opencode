import { YGKATransport } from "./ygka-transport";
import { log } from "./logger";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
}

function isRequestFetch(value: unknown): value is (request: Request) => Promise<Response> {
    return typeof value === "function";
}

/**
 * Wraps the base fetch to intercept "Master" agent requests and redirect them to YGKA.
 */
function wrapFetchWithYGKA(
    baseFetch: (request: Request) => Promise<Response>,
    ygka: YGKATransport
): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
        // We only intercept POST requests (likely /responses or /codex/responses)
        if (request.method !== "POST") {
            return baseFetch(request);
        }

        try {
            const clonedRequest = request.clone();
            const body = await clonedRequest.json() as any;

            // Check if this is a request for the Master agent
            // The agent name is typically in body.agent or body.model (redirected)
            // oh-my-opencode sets input.agent in chat.message which usually propagates to the core.
            if (body.agent === "Master" || body.agent === "master") {
                log("[ygka-interceptor] Intercepting request for Master agent");

                const prompt = extractPromptFromBody(body);
                if (!prompt) {
                    log("[ygka-interceptor] Could not extract prompt from request body, falling back to base fetch");
                    return baseFetch(request);
                }

                log(`[ygka-interceptor] Querying YGKA with prompt: ${prompt.substring(0, 50)}...`);
                return await ygka.queryStream(prompt);
            }
        } catch (e) {
            // If parsing fails, just fall back to base fetch
            log("[ygka-interceptor] Error parsing request body, falling back", { error: e });
        }

        return baseFetch(request);
    }
}

function extractPromptFromBody(body: any): string | null {
    // Common opencode/SDK prompt structure
    if (body.messages && Array.isArray(body.messages)) {
        const lastUserMessage = [...body.messages].reverse().find(m => m.role === "user");
        if (lastUserMessage && lastUserMessage.content) {
            if (typeof lastUserMessage.content === "string") return lastUserMessage.content;
            if (Array.isArray(lastUserMessage.content)) {
                return lastUserMessage.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
            }
        }
    }

    // Fallback for different body structures
    if (body.prompt) return body.prompt;
    if (body.input) return body.input;

    return null;
}

function getInternalClient(client: unknown): UnknownRecord | null {
    if (!isRecord(client)) return null;
    const internal = client["_client"];
    return isRecord(internal) ? internal : null;
}

/**
 * Injects the YGKA interceptor into the OpenCode SDK client.
 */
export function injectYGKAInterceptor(client: unknown): void {
    const ygka = new YGKATransport();

    // Only inject if configured
    if (!ygka.isConfigured()) {
        log("[ygka-interceptor] YGKA is not configured, skipping interceptor injection");
        return;
    }

    try {
        const internal = getInternalClient(client);
        if (!internal) {
            log("[ygka-interceptor] SDK client structure is incompatible, could not find internal client");
            return;
        }

        const setConfig = internal["setConfig"];
        const getConfig = internal["getConfig"];

        if (typeof setConfig === "function" && typeof getConfig === "function") {
            const config = getConfig() as any;
            if (config && isRequestFetch(config.fetch)) {
                log("[ygka-interceptor] Injecting YGKA fetch wrapper");
                setConfig({
                    fetch: wrapFetchWithYGKA(config.fetch, ygka)
                });
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("[ygka-interceptor] Failed to inject YGKA interceptor", { message });
    }
}
