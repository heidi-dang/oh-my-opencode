import { describe, expect, test } from "bun:test"
import { resolveModelPipeline } from "./model-resolution-pipeline"

describe("Model Resolution Acceptance Tests", () => {
  const availableModels = new Set([
    "minimax/minimax-0.1",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4",
  ])

  test("Case 1: Explicit Hephaestus MiniMax + parent GPT => MiniMax wins (userModel > sessionModel)", () => {
    //#given
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-4",
        userModel: "minimax/minimax-0.1",
      },
      constraints: { availableModels }
    })

    //#then
    expect(result?.model).toBe("minimax/minimax-0.1")
    expect(result?.provenance).toBe("override")
  })

  test("Case 2: No explicit Hephaestus model + supported parent model => parent inherits (sessionModel wins)", () => {
    //#given
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-4",
        userModel: undefined,
      },
      constraints: { availableModels }
    })

    //#then
    expect(result?.model).toBe("openai/gpt-4")
    expect(result?.provenance).toBe("override")
  })

  test("Case 3: No explicit Hephaestus model + unsupported parent model => session skipped, fallback used", () => {
    //#given
    const result = resolveModelPipeline({
      intent: {
        sessionModel: "openai/gpt-5.3-codex", // NOT in availableModels
        userModel: undefined,
      },
      constraints: { availableModels },
      policy: {
        fallbackChain: [
          { providers: ["anthropic"], model: "claude-3.5-sonnet" }
        ]
      }
    })

    //#then
    expect(result?.model).toBe("anthropic/claude-3.5-sonnet")
    expect(result?.provenance).toBe("provider-fallback")
  })

  test("Case 4: Explicit unsupported Hephaestus model => fallback used, never stuck queued (userModel availability validation)", () => {
    //#given
    const result = resolveModelPipeline({
      intent: {
        userModel: "minimax/unsupported-beta", // NOT in availableModels
      },
      constraints: { availableModels },
      policy: {
        fallbackChain: [
          { providers: ["anthropic"], model: "claude-3.5-sonnet" }
        ]
      }
    })

    //#then
    expect(result?.model).toBe("anthropic/claude-3.5-sonnet")
    expect(result?.provenance).toBe("provider-fallback")
  })

  test("Priority check: uiSelectedModel (if available) > userModel > sessionModel", () => {
    //#given - uiSelectedModel is available
    const result = resolveModelPipeline({
      intent: {
        uiSelectedModel: "anthropic/claude-3.5-sonnet",
        userModel: "minimax/minimax-0.1",
        sessionModel: "openai/gpt-4",
      },
      constraints: { availableModels }
    })

    //#then - UI selection always wins if available (it matches the user's manual choice in the current session)
    expect(result?.model).toBe("anthropic/claude-3.5-sonnet")
  })

  test("Priority check: userModel > uiSelectedModel (if uiSelectedModel is NOT available / stale)", () => {
    //#given - uiSelectedModel is stale/unsupported
    const result = resolveModelPipeline({
      intent: {
        uiSelectedModel: "openai/gpt-5.3-codex", // NOT available
        userModel: "minimax/minimax-0.1",
      },
      constraints: { availableModels }
    })

    //#then - UI selection skipped, userModel (configured agent model) wins
    expect(result?.model).toBe("minimax/minimax-0.1")
  })
})
