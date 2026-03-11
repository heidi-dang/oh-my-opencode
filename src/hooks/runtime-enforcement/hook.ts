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
    { phrase: "work finished", tool: "complete_task" },
    { phrase: "todos cleared", tool: "complete_task" },
    { phrase: "done.", tool: "complete_task" },
    { phrase: "fixed.", tool: "complete_task" },
    { phrase: "resolved.", tool: "complete_task" }
]

export function createRuntimeEnforcementHook(_ctx: PluginInput) {
    return {
        "experimental.chat.messages.transform": async (
            _input: any,
            output: { messages: { info: Message; parts: Part[] }[] }
        ) => {
            const sessionID = output.messages[0]?.info.sessionID
            ledger.startNewFlow(sessionID)

            // 1. Redact False Success Claims
            for (let i = 0; i < output.messages.length - 1; i++) {
                const msg = output.messages[i]
                if (msg.info.role === "assistant") {
                    const nextMsg = output.messages[i + 1]
                    if (nextMsg.info.role === "user") {
                        const hasFailureText = nextMsg.parts.some((p: any) => 
                            p.type === "text" && (
                                p.text?.includes("[Tool Contract Violation]") ||
                                p.text?.includes("[ERROR] STRICT ISSUE") ||
                                p.text?.includes("[Edit Discipline Violation]") ||
                                p.text?.includes("[Tool Contract Enforcer] Tool execution explicitly failed") ||
                                p.text?.includes("Exception in ")
                            )
                        )

                        if (hasFailureText) {
                            const isVerificationFailure = nextMsg.parts.some((p: any) => p.text?.includes("[Verification Unconfirmed]"))

                            for (const part of msg.parts) {
                                if (part.type === "text" && typeof part.text === "string") {
                                    const lowerText = part.text.toLowerCase()
                                    const hasSuspiciousClaim = SUSPICIOUS_PHRASES.some(sp => lowerText.includes(sp.phrase))
                                    if (hasSuspiciousClaim || lowerText.includes("success") || lowerText.includes("completed")) {
                                        if (isVerificationFailure) {
                                            part.text = `[REDACTED: Attempted but unverified]\n\nI attempted to perform the action, but system state verification could not confirm the outcome. Success is not yet guaranteed.`
                                        } else {
                                            part.text = `[REDACTED: False success claim invalidated by tool failure]\n\nI attempted to claim completion, but the underlying tool failed its execution or verification constraints. I must correct my approach.`
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const assistantMessages = output.messages.filter(m => m.info.role === "assistant")
            if (assistantMessages.length > 0) {
                const lastAssistant = assistantMessages[assistantMessages.length - 1]
                const textParts = lastAssistant.parts.filter((p: any) => p.type === "text")
                const toolParts = lastAssistant.parts.filter((p: any) => p.type === "tool" || p.type === "toolInvocation")
                
                const combinedText = textParts.map((p: any) => p.text || "").join("")
                const isSilent = toolParts.length > 0 && combinedText.trim().length < 10
                const isRedacted = combinedText.includes("[REDACTED: False success claim]")
                const endsOnTool = lastAssistant.parts.length > 0 && ((lastAssistant.parts[lastAssistant.parts.length - 1] as any).type === "tool" || (lastAssistant.parts[lastAssistant.parts.length - 1] as any).type === "toolInvocation")

                if (isSilent || isRedacted || endsOnTool) {
                    const isTerminalTool = toolParts.some((p: any) => p.toolName === "complete_task" || p.toolName === "git_safe")
                    const isVerificationTool = toolParts.some((p: any) => p.toolName === "report_issue_verification" || p.toolName === "verify_action")
                    const isVerificationFailure = combinedText.includes("[REDACTED: Attempted but unverified]")
                    
                    let syntheticText = ""
                    if (isVerificationFailure) {
                        syntheticText = "\n\n[SYSTEM: ATTEMPTED BUT UNVERIFIED] The action was performed but verification failed or was inconclusive. Final state is UNCONFIRMED."
                    } else if (isRedacted) {
                        syntheticText = "\n\n[SYSTEM: VERIFICATION FAILED] The agent attempted to claim completion but failed required safety or verification gates. Final state is UNSTABLE."
                    } else if (isTerminalTool) {
                        syntheticText = "\n\n[SYSTEM: TERMINAL STATE] The agent executed a completion or safety tool. Turn concluding."
                    } else if (isVerificationTool) {
                        syntheticText = "\n\n[SYSTEM: VERIFICATION LOGGED] The agent recorded progress in the strict verification workflow."
                    } else if (isSilent) {
                        syntheticText = "\n\n[SYSTEM: STALLED OR SILENT TURN] The agent performed actions but did not provide a concluding summary."
                    }

                    if (syntheticText && !combinedText.includes(syntheticText)) {
                        lastAssistant.parts.push({
                            id: `prt_synthetic_${Date.now()}`,
                            sessionID: lastAssistant.info.sessionID,
                            messageID: lastAssistant.info.id,
                            type: "text",
                            text: syntheticText
                        } as any)
                    }
                }
            }

            if (assistantMessages.length === 0) return

            const lastAssistant = assistantMessages[assistantMessages.length - 1]
            const textParts = lastAssistant.parts.filter(p => p.type === "text")
            const combinedText = textParts.map((p: any) => p.text || "").join("\n").toLowerCase()

            if (!combinedText || combinedText.includes("[runtime authorization]")) return

            for (const check of SUSPICIOUS_PHRASES) {
                if (combinedText.includes(check.phrase)) {
                    let actuallyExecuted = false;

                    if (lastAssistant.parts.some((p: any) => (p.type === "tool" || p.type === "toolInvocation") && p.toolName === check.tool)) {
                        actuallyExecuted = true;
                    } else {
                        for (let i = output.messages.length - 1; i >= 0; i--) {
                            const msg = output.messages[i];
                            if (msg.info.role === "user" && msg.parts.some((p: any) => p.type === "text" && !p.text?.toString().startsWith("[tool result]"))) {
                                break;
                            }
                            if (msg.info.role === "assistant" && msg.parts.some((p: any) => (p.type === "tool" || p.type === "toolInvocation") && p.toolName === check.tool)) {
                                actuallyExecuted = true;
                                break;
                            }
                        }
                    }

                    if (!actuallyExecuted) {
                        // Soft failure instead of throwing
                        for (const part of lastAssistant.parts) {
                            if (part.type === "text" && typeof part.text === "string") {
                                if (part.text.toLowerCase().includes(check.phrase)) {
                                    part.text = `[REDACTED: False completion claim (${check.phrase})]\n\nI described changes as completed, but the corresponding tool (${check.tool}) was not executed in the current completion flow. My claim has been intercepted.`
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
