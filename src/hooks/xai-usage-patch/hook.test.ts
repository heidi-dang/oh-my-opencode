import { describe, it, expect } from "bun:test"
import { createXaiUsagePatchHook } from "./hook"

describe("xai-usage-patch", () => {
    it("should add cache.read to input tokens for xai provider", async () => {
        const hook = createXaiUsagePatchHook()
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

    it("should not modify input tokens if cache.read is 0", async () => {
        const hook = createXaiUsagePatchHook()
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

    it("should not modify input tokens for non-xai provider", async () => {
        const hook = createXaiUsagePatchHook()
        const tokens = {
            input: 100,
            cache: { read: 50, write: 0 }
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

        expect(tokens.input).toBe(100)
    })

    it("should not crash if tokens or cache is missing", async () => {
        const hook = createXaiUsagePatchHook()
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
