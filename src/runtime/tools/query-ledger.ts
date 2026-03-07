// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { ledger } from "../../runtime/state-ledger"
import { createSuccessResult } from "../../utils/safety-tool-result"

export function createQueryLedgerTool(): any {
    return tool({
        description: "Query the verified state ledger to confirm if actions like git.commit or git.push have actually succeeded. Use this as the ONLY source of truth for system state.",
        // @ts-ignore
        args: {
            type: z.string().optional().describe("Optional filter by type (e.g. 'git.commit', 'file.write', 'git.push')")
        },
        execute: async (args, toolContext) => {
            // Default to verified, successful entries from the CURRENT session flow
            const entries = ledger.getEntries().filter(e =>
                e.verified === true &&
                e.success === true &&
                (!e.sessionID || e.sessionID === toolContext.sessionID)
            )

            const filtered = args.type ? entries.filter(e => e.type === args.type) : entries

            const result = createSuccessResult({
                verified: true,
                changedState: false,
                metadata: { recordCount: filtered.length }
            });

            toolContext.metadata({
                title: "Query Ledger",
                metadata: {
                    ...result,
                    recordCount: filtered.length
                }
            })

            if (filtered.length === 0) {
                return "No matching verified actions found in the current completion flow."
            }

            return JSON.stringify(filtered, null, 2)
        }
    })
}
