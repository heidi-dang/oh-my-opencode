import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { ledger } from "../../runtime/state-ledger"

export const createQueryLedgerTool = () => tool({
    description: "Query the verified state ledger to confirm if actions like git.commit or git.push have actually succeeded. Use this as the ONLY source of truth for system state.",
    // @ts-ignore
    args: {
        type: z.string().optional().describe("Optional filter by type (e.g. 'git.commit', 'file.write', 'git.push')")
    },
    execute: async (args, toolContext) => {
        const entries = ledger.getEntries()
        const filtered = args.type ? entries.filter(e => e.type === args.type) : entries

        toolContext.metadata({
            title: "Query Ledger",
            metadata: { recordCount: filtered.length }
        })

        if (filtered.length === 0) {
            return "No matching verified actions found in the ledger."
        }

        return JSON.stringify(filtered, null, 2)
    }
})
