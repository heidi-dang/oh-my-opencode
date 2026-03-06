// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { ledger } from "../../runtime/state-ledger"

export function createCompleteTaskTool(): any {
    return tool({
        description: "Signal that the task is complete. The runtime will compose the final verified state report. DO NOT output your own summary, just call this tool.",
        // @ts-ignore
        args: {
            message: z.string().describe("Optional short note about what was done. Do not include PR URLs or commit hashes here.")
        },
        execute: async (args, toolContext) => {
            // Filter strictly: verified, successful, state changes, and only in THIS session flow
            const entries = ledger.getEntries().filter(e =>
                e.verified === true &&
                e.success === true &&
                e.changedState === true &&
                (!e.sessionID || e.sessionID === toolContext.sessionID)
            )

            // Compile verifiable evidence report
            let report = `TASK COMPLETE.\n\nRuntime Verified Actions (Current Flow):\n`
            if (entries.length === 0) {
                report += "- No state changes recorded in this session.\n"
            } else {
                for (const entry of entries) {
                    report += `- [${entry.type}] ${entry.key}\n`
                }
            }

            if (args.message) {
                report += `\nAgent Note: ${args.message}\n`
            }

            toolContext.metadata({
                title: "Task Completed",
                metadata: { success: true, verified: true, changedState: false, sessionID: toolContext.sessionID, entries: entries.length, note: args.message }
            })

            return `[RUNTIME AUTHORIZATION]\n\n${report}\n\nYou may now conclude your response using EXACTLY this report as your final output.`
        }
    })
}
