// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { ledger } from "../state-ledger"
import { createSuccessResult } from "../../utils/safety-tool-result"
import { withToolContract } from "../../utils/tool-contract-wrapper"

export function createQueryLedgerTool(options?: { backgroundManager?: any }): any {
    return tool({
        description: "Query the verified state ledger to confirm if actions like git.commit or git.push have actually succeeded. Use this as the ONLY source of truth for system state.",
        // @ts-ignore
        args: {
            type: z.string().optional().describe("Optional filter by type (e.g. 'git.commit', 'file.write', 'git.push')")
        },
        execute: withToolContract("query_ledger", async (args, toolContext) => {
            const descendantSessions = options?.backgroundManager?.getAllDescendantTasks 
                ? options.backgroundManager.getAllDescendantTasks(toolContext.sessionID).map((t: any) => t.sessionID).filter(Boolean)
                : [];
            const sessionIDs = [toolContext.sessionID, ...descendantSessions];

            // Default to verified, successful entries from the CURRENT session flow (or descendants)
            const entries = ledger.getEntries(args.type, sessionIDs).filter(e =>
                e.verified === true &&
                e.success === true
            )

            const filtered = entries

            const result = createSuccessResult({
                verified: true,
                changedState: false,
                recordCount: filtered.length
            });

            toolContext.metadata({
                title: "Query Ledger",
                ...result
            })

            if (filtered.length === 0) {
                return "No matching verified actions found in the current completion flow."
            }

            return JSON.stringify(filtered, null, 2)
        })
    })
}
