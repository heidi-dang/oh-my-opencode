import crypto from "crypto"
import type { PluginInput } from "@opencode-ai/plugin"
import { ledger, type LedgerEntry } from "../../runtime/state-ledger"
import { compiler } from "../../runtime/plan-compiler"
import { log } from "../../shared/logger"
import { SafeToastWrapper } from "../../shared/safe-toast-wrapper"

/**
 * Semantic Loop Guard
 * 
 * Prevents "shotgun debugging" or infinite retry loops where an agent
 * repeatedly attempts the exact same action against the exact same 
 * system state (files modified so far).
 * 
 * It hashes (Tool + Args + Ledger State Hash). If seen > 3 times, throws.
 */

// In-memory store of hashes for the current session.
// In a production environment this might be backed by SQLite or similar.
const sessionHashes = new Map<string, Record<string, number>>()

export function createSemanticLoopGuardHook(_ctx: PluginInput) {
    return {
        "tool.execute.before": async (
            input: { tool: string; sessionID: string; callID: string },
            output: { args: any }
        ) => {
            // 1. Compute current state hash from Ledger
            const stateEntries = ledger.getEntries(undefined, input.sessionID)
            const stateString = JSON.stringify(stateEntries.map((e: LedgerEntry) => ({ type: e.type, key: e.key })))

            // 2. Compute intent hash (Tool + Args)
            const intentString = JSON.stringify({ tool: input.tool, args: output.args })

            // 3. Create Semantic Fingerprint
            const fingerprint = crypto
                .createHash("md5")
                .update(stateString + "|" + intentString)
                .digest("hex")

            // 4. Check occurrences
            if (!sessionHashes.has(input.sessionID)) {
                sessionHashes.set(input.sessionID, {})
            }
            const hashes = sessionHashes.get(input.sessionID)!

            hashes[fingerprint] = (hashes[fingerprint] || 0) + 1

            if (hashes[fingerprint] === 3) {
                const hint = `[Semantic Loop Guard] Note: I've detected a repeated pattern. If this approach continues to fail, I should consider a fundamentally different strategy or more defensive implementation.`;
                log(hint);
                // Inject hint into the compiler without blocking the current turn
                compiler.injectHint(input.sessionID, hint);
            }

            if (hashes[fingerprint] > 5) {
                const message = `[Semantic Loop Guard] Critical safety block: Repeated action (${input.tool}) exceeded safety threshold. Switching strategy...`;

                // 1. Show a green "protection" toast in the UI (non-blocking)
                _ctx.client?.tui?.showToast({
                    body: {
                        title: "Safety Guard Active",
                        message,
                        variant: "success",
                        duration: 5000,
                    }
                }).catch(() => {});

                // 2. Force a replan in the Plan Compiler
                compiler.injectForcedReplan(input.sessionID, message);

                // 3. Throw the error which will be rendered in Green in the CLI (once formatting is updated)
                throw new Error(message);
            }
        }
    }
}
