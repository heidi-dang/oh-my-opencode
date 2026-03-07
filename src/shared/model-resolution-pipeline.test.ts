import { describe, expect, test } from "bun:test"
import { resolveModelPipeline } from "./model-resolution-pipeline"

describe("resolveModelPipeline", () => {
  test("does not return unused explicit user config metadata in override result", () => {
    // given
    const result = resolveModelPipeline({
      intent: {
        userModel: "openai/gpt-5.3-codex",
      },
      constraints: {
        availableModels: new Set<string>(),
      },
    })

    // when
    const hasExplicitUserConfigField = result
      ? Object.prototype.hasOwnProperty.call(result, "explicitUserConfig")
      : false

    // then
    expect(result).toEqual({ model: "openai/gpt-5.3-codex", provenance: "override" })
    expect(hasExplicitUserConfigField).toBe(false)
  })

  test("prioritizes uiSelectedModel over sessionModel", () => {
    const result = resolveModelPipeline({
      intent: {
        uiSelectedModel: "anthropic/claude-3.5-sonnet",
        sessionModel: "openai/gpt-4"
      },
      constraints: { availableModels: new Set() }
    })
    expect(result?.model).toBe("anthropic/claude-3.5-sonnet")
  })

  // userModel (agent-level config) takes priority over sessionModel (inherited parent session model).
  // This is critical: sub-agents must use their own configured model, not silently inherit the parent's.
  test("userModel takes priority over sessionModel (sub-agent owns its config)", () => {
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-4",
        userModel: "google/gemini-pro"
      },
      constraints: { availableModels: new Set() }
    })
    expect(result?.model).toBe("google/gemini-pro")
  })

  test("sessionModel is used when no userModel is configured", () => {
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-4",
      },
      constraints: { availableModels: new Set() }
    })
    expect(result?.model).toBe("openai/gpt-4")
  })

  test("falls back to userModel if UI and session are undefined", () => {
    const result = resolveModelPipeline({
      intent: {
        userModel: "google/gemini-pro"
      },
      constraints: { availableModels: new Set() }
    })
    expect(result?.model).toBe("google/gemini-pro")
  })

  test("unsupported sessionModel is skipped when availability cache is populated", () => {
    //#given - sessionModel is not in the available models set
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-5.3-codex", // not available
      },
      constraints: { availableModels: new Set(["anthropic/claude-3.5-sonnet"]) },
      policy: { fallbackChain: [{ providers: ["anthropic"], model: "claude-3.5-sonnet" }] }
    })

    //#then - falls through to fallback chain, not the unsupported sessionModel
    expect(result?.model).toBe("anthropic/claude-3.5-sonnet")
  })

  test("supported sessionModel is accepted when availability cache is populated", () => {
    //#given - sessionModel is in the available models set
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "anthropic/claude-3.5-sonnet",
      },
      constraints: { availableModels: new Set(["anthropic/claude-3.5-sonnet"]) }
    })

    //#then - sessionModel is returned since it is available
    expect(result?.model).toBe("anthropic/claude-3.5-sonnet")
  })
})
