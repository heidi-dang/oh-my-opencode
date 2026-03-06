import { describe, it, expect } from "bun:test"
import { resolveModel } from "../src/shared/model-resolver"

describe("Hephaestus Model Resolution Regression", () => {
    it("should respect explicit user configuration for Hephaestus", () => {
        const input = {
            userModel: "anthropic/claude-3-5-sonnet",
            inheritedModel: "openai/gpt-5.3-codex",
            systemDefault: "opencode/gpt-5-nano"
        }

        const resolved = resolveModel(input)

        // Should NOT be forced to GPT just because it's Hephaestus (resolver doesn't know agent role, but policy should allow it)
        expect(resolved).toBe("anthropic/claude-3-5-sonnet")
    })

    it("should fallback to system default if no user model is set", () => {
        const input = {
            userModel: undefined,
            inheritedModel: undefined,
            systemDefault: "opencode/gpt-5-nano"
        }

        const resolved = resolveModel(input)
        expect(resolved).toBe("opencode/gpt-5-nano")
    })
})
