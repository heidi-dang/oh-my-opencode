import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { ledger } from "../../runtime/state-ledger"

/**
 * Runtime Enforcement Gate
 * 
 * Scans outgoing assistant messages for phrases that imply completion.
 * Enforces Completion Authority: Only 'complete_task' can declare the task finished.
 */

const SUSPICIOUS_PHRASES = [
    { phrase: "pr created", tool: "git_safe" },
    { phrase: "pull request created", tool: "git_safe" },
    { phrase: "pr opened", tool: "git_safe" },
    { phrase: "pull request opened", tool: "git_safe" },
    { phrase: "push complete", tool: "git_safe" },
    { phrase: "pushed successfully", tool: "git_safe" },
    { phrase: "successfully pushed", tool: "git_safe" },
    { phrase: "commit created", tool: "git_safe" },
    { phrase: "committed successfully", tool: "git_safe" },
    { phrase: "successfully committed", tool: "git_safe" },
    { phrase: "task completed", tool: "complete_task" },
    { phrase: "task complete", tool: "complete_task" },
    { phrase: "work finished", tool: "complete_task" }
]

export function createRuntimeEnforcementHook(_ctx: PluginInput) {
    return {
        "experimental.chat.messages.transform": async (
            _input: any,
            output: { messages: { info: Message; parts: Part[] }[] }
        ) => {
            // Mark the start of a new completion flow verification.
            // This ensures entries from previous turns/flows in the same session are ignored.
            ledger.startNewFlow()

            const assistantMessages = output.messages.filter(m => m.info.role === "assistant")
            if (assistantMessages.length === 0) return

            const lastAssistant = assistantMessages[assistantMessages.length - 1]
            const textParts = lastAssistant.parts.filter(p => p.type === "text")
            const combinedText = textParts.map((p: any) => p.text || "").join("\n").toLowerCase()

            if (!combinedText || combinedText.includes("[runtime authorization]")) return

            for (const check of SUSPICIOUS_PHRASES) {
                if (combinedText.includes(check.phrase)) {
                    let actuallyExecuted = false;

                    // Check if the current message calls the tool
                    if (lastAssistant.parts.some((p: any) => p.type === "toolInvocation" && p.toolName === check.tool)) {
                        actuallyExecuted = true;
                    } else {
                        // Check backwards for the tool call in the current completion flow
                        for (let i = output.messages.length - 1; i >= 0; i--) {
                            const msg = output.messages[i];
                            if (msg.info.role === "user" && msg.parts.some((p: any) => p.type === "text" && !p.text?.toString().startsWith("[tool result]"))) {
                                // Reached an actual user instruction, stop looking backwards. This isolates the check to the *current completion flow*.
                                break;
                            }
                            if (msg.info.role === "assistant" && msg.parts.some((p: any) => p.type === "toolInvocation" && p.toolName === check.tool)) {
                                actuallyExecuted = true;
                                break;
                            }
                        }
                    }

                    if (!actuallyExecuted) {
                        throw new Error(
                            `[Runtime Enforcement Guard] State claim REJECTED. ` +
                            `\nAgent text contained "${check.phrase}" but ${check.tool} was not executed in the current completion flow. ` +
                            `You MUST execute the corresponding tool instead of just claiming completion.`
                        )
                    }
                }
            }
        }
    }
}
