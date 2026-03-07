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

  test("prioritizes sessionModel over userModel", () => {
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-4",
        userModel: "google/gemini-pro"
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
})
