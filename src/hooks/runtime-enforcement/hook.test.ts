import { expect, test, describe, beforeEach } from "bun:test"
import { createRuntimeEnforcementHook } from "./hook"

describe("Runtime Enforcement", () => {
    describe("False Success Redaction", () => {
        test("redacts suspicious phrases if subsequent complete_task result contains Tool Contract Violation", async () => {
            const hook = createRuntimeEnforcementHook({} as any)
            const executeHook = hook["experimental.chat.messages.transform"]
            
            const messages = [
                {
                    info: { role: "assistant" },
                    parts: [
                        { type: "text", text: "I have finished everything. Todos cleared!" },
                        { type: "toolInvocation", toolName: "complete_task" }
                    ]
                },
                {
                    info: { role: "user" },
                    parts: [
                        { type: "text", text: "[tool result] \n [Tool Contract Violation] Tool complete_task did not return structured boolean metadata" }
                    ]
                }
            ]

            await executeHook({}, { messages } as any)

            const redactedText = messages[0].parts[0].text
            expect(redactedText).toContain("[REDACTED: False success claim invalidated by tool failure]")
            expect(redactedText).not.toContain("Todos cleared!")
        })
    })
})
