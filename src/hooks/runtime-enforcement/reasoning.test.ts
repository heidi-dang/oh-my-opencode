import { describe, it, expect } from "bun:test"
import { createRuntimeEnforcementHook } from "./hook"

describe("RuntimeEnforcementHook", () => {
    const hook = createRuntimeEnforcementHook({} as any)

    it("#should NOT flag as silent if reasoning part is present", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [
                        { type: "reasoning", reasoning: "This is a long reasoning block that explains my plan perfectly." },
                        { type: "toolInvocation", toolName: "ls" }
                    ]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        const lastMsg = output.messages[0]
        const hasWarning = lastMsg.parts.some((p: any) => p.text?.includes("STALLED OR SILENT TURN"))
        expect(hasWarning).toBe(false)
    })

    it("#should flag as silent if NO informative parts are present", async () => {
        const output = {
            messages: [
                {
                    info: { role: "assistant", sessionID: "s1", id: "m1" },
                    parts: [
                        { type: "toolInvocation", toolName: "ls" }
                    ]
                }
            ]
        }

        await hook["experimental.chat.messages.transform"]({}, output as any)

        const lastMsg = output.messages[0]
        const hasWarning = lastMsg.parts.some((p: any) => p.text?.includes("STALLED OR SILENT TURN"))
        expect(hasWarning).toBe(true)
    })
})
