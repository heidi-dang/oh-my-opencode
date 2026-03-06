import type { PluginInput } from "@opencode-ai/plugin"
import { journal } from "../../runtime/journal"
import { ledger, type LedgerEntryType } from "../../runtime/state-ledger"

/**
 * Hook to automatically log all tool executions to the execution journal.
 * 
 * This also inspects the result of "safe wrapper tools" (like git_safe)
 * to automatically record state changes in the State Ledger without trusting
 * the LLM to report them accurately.
 */
export function createExecutionJournalHook(ctx: PluginInput) {
    return {
        "tool.execute.after": async (
            input: { tool: string; sessionID: string; callID: string },
            output: { title: string; output: string; metadata: any }
        ) => {
            // 1. Log to the Execution Journal
            journal.log({
                sessionID: input.sessionID,
                agent: "tracked-agent", // Set dynamically if possible, handled generically here
                intent: "execute_tool",
                tool: input.tool,
                args: output.metadata?.args,
                stdout: output.output,
                verificationState: output.metadata?.changedState
            })

            // 2. Automatic State Ledger Sync for standard tools
            // This is our source of truth. If a tool executed a side-effect,
            // the tool wrapper itself must set `metadata.stateChange`

            if (output.metadata?.stateChange) {
                const payload = output.metadata.stateChange as {
                    type: LedgerEntryType
                    key: string
                    details: any
                }

                const success = !!output.metadata?.success
                const changedState = !!output.metadata?.changedState
                const verified = output.metadata?.verified !== false // Defaults to true unless explicitly unverified

                ledger.record(payload.type, payload.key, success, verified, changedState, output.output, payload.details, input.sessionID)
            } else {
                // Fallback heuristics for raw bash operations (if not yet disabled)
                if (input.tool === "interactive_bash" || input.tool === "bash") {
                    const args = output.metadata?.args as any
                    const command = args?.command || ""

                    if (typeof command === "string") {
                        if (command.includes("git push") && output.output.includes("Everything up-to-date") === false) {
                            ledger.record("git.push", "origin", true, true, true, output.output, { command }, input.sessionID)
                        } else if (command.includes("git commit")) {
                            ledger.record("git.commit", "HEAD", true, true, true, output.output, { command }, input.sessionID)
                        } else if (command.includes("gh pr create") && output.output.includes("https://github.com")) {
                            // naive extraction for bash fallback
                            const urlMatch = output.output.match(/https:\/\/github\.com[^\s]+/)
                            if (urlMatch) {
                                ledger.record("git.pr", urlMatch[0], true, true, true, output.output, { command }, input.sessionID)
                            }
                        }
                    }
                }
            }
        }
    }
}
