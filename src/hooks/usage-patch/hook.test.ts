import { describe, it, expect } from "bun:test"
import { createUsagePatchHook } from "./hook"

describe("usage-patch", () => {
    it("should add cache.read to input tokens for xai provider", async () => {
        const hook = createUsagePatchHook()
        const tokens = {
            input: 100,
            cache: { read: 50, write: 0 }
        }
        const event = {
            type: "message.updated",
            properties: {
                info: {
                    role: "assistant",
                    providerID: "xai",
                    tokens: tokens
                }
            }
        }

        await hook.event({ event } as any)

        expect(tokens.input).toBe(150)
    })

    it("should add cache.read to input tokens for anthropic provider (generalized)", async () => {
        const hook = createUsagePatchHook()
        const tokens = {
            input: 200,
            cache: { read: 80, write: 0 }
        }
        const event = {
            type: "message.updated",
            properties: {
                info: {
                    role: "assistant",
                    providerID: "anthropic",
                    tokens: tokens
                }
            }
        }

        await hook.event({ event } as any)

        expect(tokens.input).toBe(280)
    })

    it("should not modify input tokens if cache.read is 0", async () => {
        const hook = createUsagePatchHook()
        const tokens = {
            input: 100,
            cache: { read: 0, write: 0 }
        }
        const event = {
            type: "message.updated",
            properties: {
                info: {
                    role: "assistant",
                    providerID: "xai",
                    tokens: tokens
                }
            }
        }

        await hook.event({ event } as any)

        expect(tokens.input).toBe(100)
    })

    it("should not crash if tokens or cache is missing", async () => {
        const hook = createUsagePatchHook()
        const event = {
            type: "message.updated",
            properties: {
                info: {
                    role: "assistant",
                    providerID: "xai",
                    // tokens missing
                }
            }
        }

        // Just calling it should not throw
        await hook.event({ event } as any)
    })
})
