import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { ledger } from "../../runtime/state-ledger"

/**
 * Runtime Enforcement Gate
 * 
 * Scans outgoing/historical assistant messages for phrases that imply completion
 * of state-changing operations (Git push, PR creation, commits).
 * If the agent claims success but the State Ledger has no record of the tool
 * actually executing, it throws a hard error.
 */

const SUSPICIOUS_PHRASES = [
    { phrase: "pr created", type: "git.pr" },
    { phrase: "pull request created", type: "git.pr" },
    { phrase: "pr opened", type: "git.pr" },
    { phrase: "pull request opened", type: "git.pr" },
    { phrase: "push complete", type: "git.push" },
    { phrase: "pushed successfully", type: "git.push" },
    { phrase: "successfully pushed", type: "git.push" },
    { phrase: "commit created", type: "git.commit" },
    { phrase: "committed successfully", type: "git.commit" },
    { phrase: "successfully committed", type: "git.commit" }
]

export function createRuntimeEnforcementHook(_ctx: PluginInput) {
    return {
        "experimental.chat.messages.transform": async (
            _input: any,
            output: { messages: { info: Message; parts: Part[] }[] }
        ) => {
            // Find the most recent assistant message
            const assistantMessages = output.messages.filter(m => m.info.role === "assistant")
            if (assistantMessages.length === 0) return

            const lastAssisant = assistantMessages[assistantMessages.length - 1]

            // Extract text content
            const textParts = lastAssisant.parts.filter(p => p.type === "text")
            const combinedText = textParts.map((p: any) => p.text || "").join("\n").toLowerCase()

            if (!combinedText) return

            for (const check of SUSPICIOUS_PHRASES) {
                if (combinedText.includes(check.phrase)) {
                    // Rule violation check: Did the agent actually do this?
                    const actuallyExecuted = ledger.has(check.type as any, () => true)

                    if (!actuallyExecuted) {
                        throw new Error(
                            `[Runtime Enforcement Guard] State change claimed without tool execution.` +
                            `\nAgent text contained "${check.phrase}" but the State Ledger shows no record of ${check.type}. ` +
                            `You must execute the tool before claiming success.`
                        )
                    }
                }
            }
        }
    }
}
