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

    it("#should not inject if no roadblock is found", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [{ type: "text", text: "I have successfully installed the package." }]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        expect(output.messages[0].parts.length).toBe(1)
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
