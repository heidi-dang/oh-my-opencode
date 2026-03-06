import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { stateLedger } from "../../agents/runtime/state-ledger"

/**
 * Runtime Enforcement Gate
 * 
 * Scans outgoing assistant messages for phrases that imply completion.
 * Enforces Completion Authority: Only 'complete_task' can declare the task finished.
 */

const SUSPICIOUS_PHRASES = [
    { phrase: "pr created", type: "git_safe" },
    { phrase: "pull request created", type: "git_safe" },
    { phrase: "pr opened", type: "git_safe" },
    { phrase: "pull request opened", type: "git_safe" },
    { phrase: "push complete", type: "git_safe" },
    { phrase: "pushed successfully", type: "git_safe" },
    { phrase: "successfully pushed", type: "git_safe" },
    { phrase: "commit created", type: "git_safe" },
    { phrase: "committed successfully", type: "git_safe" },
    { phrase: "successfully committed", type: "git_safe" },
    { phrase: "task completed", type: "complete_task" },
    { phrase: "task complete", type: "complete_task" },
    { phrase: "work finished", type: "complete_task" },
    { phrase: "success", type: "complete_task" }
]

export function createRuntimeEnforcementHook(_ctx: PluginInput) {
    return {
        "experimental.chat.messages.transform": async (
            _input: any,
            output: { messages: { info: Message; parts: Part[] }[] }
        ) => {
            const assistantMessages = output.messages.filter(m => m.info.role === "assistant")
            if (assistantMessages.length === 0) return

            const lastAssistant = assistantMessages[assistantMessages.length - 1]
            const textParts = lastAssistant.parts.filter(p => p.type === "text")
            const combinedText = textParts.map((p: any) => p.text || "").join("\n").toLowerCase()

            if (!combinedText || combinedText.includes("[runtime authorization]")) return

            for (const check of SUSPICIOUS_PHRASES) {
                if (combinedText.includes(check.phrase)) {
                    // Check if the ledger has a successful record for this tool type
                    const entries = stateLedger.getEntries()
                    const actuallyExecuted = entries.some(e => e.type === check.type && e.success && e.verified)

                    if (!actuallyExecuted) {
                        throw new Error(
                            `[Runtime Enforcement Guard] State claim REJECTED. ` +
                            `\nAgent text contained "${check.phrase}" but the State Ledger has no verified record of ${check.type}. ` +
                            `You MUST execute the corresponding tool and use 'complete_task' for final reports.`
                        )
                    }
                }
            }
        }
    }
}

