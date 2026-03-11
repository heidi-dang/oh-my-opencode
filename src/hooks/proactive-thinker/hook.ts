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
    "directory doesn't exist"
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

export function createProactiveThinkerHook(_ctx: PluginInput) {
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

            const hasRoadblock = ROADBLOCK_PHRASES.some(phrase => combinedText.includes(phrase))
            const hasAlreadyInjected = combinedText.includes("[system: proactive search mode]")

            if (hasRoadblock && !hasAlreadyInjected) {
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
            }
        }
    }
}
