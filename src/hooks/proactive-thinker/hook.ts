import type { PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"
import { log } from "../../shared/logger"

/**
 * Proactive Thinker Hook
 * 
 * Detects phrases that imply the agent is stuck or giving up.
 * Injects a system directive to push it into proactive search mode.
 */

const ROADBLOCK_PHRASES = [
    "i can't proceed",
    "missing source code",
    "installation is broken",
    "failed to find",
    "could not find",
    "exhausted",
    "stopping because",
    "missing file",
    "broken install",
    "directory doesn't exist",
    "no output",
    "no git repo",
    "remote -v failed"
]

const INTENT_PHRASES = [
    "let me search",
    "i will search",
    "searching for",
    "i'll look for",
    "let me check",
    "i'll check",
    "let me try",
    "i'll try"
]

const PROACTIVE_STRATEGY = `
[SYSTEM: PROACTIVE SEARCH MODE] 
I detected a technical roadblock. Instead of stopping with a question, I will now broaden my search:
1) Search parent directories (..) recursively
2) Search for alternative implementations or filenames
3) Check common system locations or the user's home directory
4) Look for hidden config files or .env files for hints
5) Verify my current location and previous successful commands

I will attempt at least ONE broader search action before providing a truncated summary of findings.
`

const INTENT_NUDGE = `
[SYSTEM: INTENT DETECTED BUT NO ACTION]
You mentioned an intent to search/check, but you did not provide a tool call in your response. 
Please provide the corresponding tool call now to proceed and fulfill your stated intent.
`

export function createProactiveThinkerHook(_ctx: PluginInput) {
    return {
        "experimental.chat.messages.transform": async (
            _input: any,
            output: { messages: { info: Message; parts: Part[] }[] }
        ) => {
            const assistantMessages = output.messages.filter(m => m.info.role === "assistant")
            if (assistantMessages.length === 0) return

            const lastAssistant = assistantMessages[assistantMessages.length - 1]
            const informativeParts = lastAssistant.parts.filter((p: any) => 
                p.type === "text" || p.type === "thought" || p.type === "thinking" || p.type === "reasoning"
            )
            const toolParts = lastAssistant.parts.filter((p: any) => p.type === "tool" || p.type === "toolInvocation")
            const combinedText = informativeParts.map((p: any) => p.text || (p as any).thought || (p as any).thinking || (p as any).reasoning || "").join("\n").toLowerCase()

            const hasRoadblock = ROADBLOCK_PHRASES.some(phrase => combinedText.includes(phrase))
            const hasAlreadyProactive = combinedText.includes("[system: proactive search mode]")
            const hasIntent = INTENT_PHRASES.some(phrase => combinedText.includes(phrase))
            const hasAlreadyNudged = combinedText.includes("[system: intent detected but no action]")

            if (hasRoadblock && !hasAlreadyProactive) {
                log("[ProactiveThinker] Roadblock detected. Injecting strategy...", {
                    phrase: ROADBLOCK_PHRASES.find(p => combinedText.includes(p))
                })

                lastAssistant.parts.push({
                    id: `prt_proactive_${Date.now()}`,
                    sessionID: lastAssistant.info.sessionID,
                    messageID: lastAssistant.info.id,
                    type: "text",
                    text: `\n\n${PROACTIVE_STRATEGY}`
                } as any)
            } else if (hasIntent && toolParts.length === 0 && !hasAlreadyNudged) {
                 log("[ProactiveThinker] Intent without tool detected. Injecting nudge...", {
                    phrase: INTENT_PHRASES.find(p => combinedText.includes(p))
                })

                lastAssistant.parts.push({
                    id: `prt_intent_nudge_${Date.now()}`,
                    sessionID: lastAssistant.info.sessionID,
                    messageID: lastAssistant.info.id,
                    type: "text",
                    text: `\n\n${INTENT_NUDGE}`
                } as any)
            }
        }
    }
}
