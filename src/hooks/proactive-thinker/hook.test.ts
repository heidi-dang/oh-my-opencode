import { describe, it, expect } from "bun:test"
import { createProactiveThinkerHook } from "./hook"

describe("ProactiveThinkerHook", () => {
    const hook = createProactiveThinkerHook({} as any)

    it("#should inject proactive strategy when roadblock is detected", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [{ type: "text", text: "I can't proceed because the installation is broken." }]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        expect(output.messages[0].parts.length).toBe(2)
        expect(output.messages[0].parts[1].text).toContain("[SYSTEM: PROACTIVE SEARCH MODE]")
    })

    it("#should inject nudge when intent is detected without tool", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [{ type: "reasoning", reasoning: "Let me search for the file." }]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        expect(output.messages[0].parts.length).toBe(2)
        expect(output.messages[0].parts[1].text).toContain("[SYSTEM: INTENT DETECTED BUT NO ACTION]")
    })

    it("#should not inject if tool is present", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [
                        { type: "text", text: "Let me search for the file." },
                        { type: "toolInvocation", toolName: "ls" }
                    ]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        expect(output.messages[0].parts.length).toBe(2) // No injection
    })

    it("#should not inject twice", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [
                        { type: "text", text: "i can't proceed. [SYSTEM: PROACTIVE SEARCH MODE]" }
                    ]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        expect(output.messages[0].parts.length).toBe(1)
    })
})
