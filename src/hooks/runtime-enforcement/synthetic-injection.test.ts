import { describe, expect, test } from "bun:test"
import { createRuntimeEnforcementHook } from "./hook"

describe("Runtime Enforcement Hook - Synthetic Terminal Injection", () => {
    test("Injects synthetic text block if assistant ends silent on a terminal tool", async () => {
        const hook = createRuntimeEnforcementHook({} as any)
        
        const output = {
            messages: [
                {
                    info: { role: "assistant", id: "msg1", sessionID: "sess1" },
                    parts: [
                        { type: "tool", toolName: "complete_task" }
                    ]
                }
            ]
        }
        
        // This mutates output
        await hook["experimental.chat.messages.transform"]({}, output as any)
        
        const lastMsg = output.messages[0]
        expect(lastMsg.parts.length).toBe(2)
        expect(lastMsg.parts[1].type).toBe("text")
        expect((lastMsg.parts[1] as any).text).toContain("[SYSTEM: TERMINAL STATE]")
    })

    test("Still injects TERMINAL STATE when substantial text accompanies a terminal tool", async () => {
        const hook = createRuntimeEnforcementHook({} as any)
        
        const output = {
            messages: [
                {
                    info: { role: "assistant", id: "msg1", sessionID: "sess1" },
                    parts: [
                        { type: "text", text: "I am finishing. I have addressed all the required steps and the session can conclude now." },
                        { type: "tool", toolName: "complete_task" }
                    ]
                }
            ]
        }
        
        await hook["experimental.chat.messages.transform"]({}, output as any)
        
        const lastMsg = output.messages[0]
        // endsOnTool always appends TERMINAL STATE note; isSilent=false (long text) but endsOnTool=true
        expect(lastMsg.parts.length).toBe(3)
        expect((lastMsg.parts[2] as any).text).toContain("[SYSTEM: TERMINAL STATE]")
    })
    
    test("Injects stall notice if the tool was not a terminal one and no summary text", async () => {
        const hook = createRuntimeEnforcementHook({} as any)
        
        const output = {
            messages: [
                {
                    info: { role: "assistant", id: "msg1", sessionID: "sess1" },
                    parts: [
                        { type: "tool", toolName: "ls" }
                    ]
                }
            ]
        }
        
        await hook["experimental.chat.messages.transform"]({}, output as any)
        
        const lastMsg = output.messages[0]
        // Non-terminal silent tools get a stall notice
        expect(lastMsg.parts.length).toBe(2)
        expect(lastMsg.parts[1].type).toBe("text")
        expect((lastMsg.parts[1] as any).text).toContain("[SYSTEM: STALLED OR SILENT TURN]")
    })
    
    test("Injects synthetic text block if terminal due to a runtime error", async () => {
        const hook = createRuntimeEnforcementHook({} as any)
        
        const output = {
            messages: [
                {
                    info: { role: "assistant", id: "msg1", sessionID: "sess1" },
                    parts: [
                        { type: "tool", toolName: "ls" }
                    ]
                },
                {
                    info: { role: "user", id: "msg2", sessionID: "sess1" },
                    parts: [
                        { type: "text", text: "[Runtime Fallback] Engine failed" }
                    ]
                }
            ]
        }
        
        await hook["experimental.chat.messages.transform"]({}, output as any)
        
        const lastAssistant = output.messages[0]
        expect(lastAssistant.parts.length).toBe(2)
        expect(lastAssistant.parts[1].type).toBe("text")
        expect((lastAssistant.parts[1] as any).text).toContain("[SYSTEM: STALLED OR SILENT TURN]")
    })
})
