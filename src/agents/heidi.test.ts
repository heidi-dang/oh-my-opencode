import { describe, expect, test } from "bun:test"
import { createHeidiAgent } from "./heidi"

describe("createHeidiAgent", () => {
  test("uses a low-latency GPT execution profile", () => {
    // given
    const model = "github-copilot/gpt-5-mini"

    // when
    const config = createHeidiAgent(model, undefined, ["read_file", "grep_search"])

    // then
    expect(config.model).toBe(model)
    expect(config.maxTokens).toBe(24000)
    expect(config.reasoningEffort).toBe("low")
    expect(config.textVerbosity).toBe("low")
    expect(config.thinking).toBeUndefined()
    expect(config.prompt).toContain("low-latency mode")
    expect(config.prompt).toContain("- read_file")
    expect(config.prompt).toContain("- grep_search")
  })

  test("disables non-GPT thinking by default", () => {
    // given
    const model = "anthropic/claude-3-5-haiku"

    // when
    const config = createHeidiAgent(model)

    // then
    expect(config.maxTokens).toBe(24000)
    expect(config.textVerbosity).toBe("low")
    expect(config.reasoningEffort).toBeUndefined()
    expect(config.thinking).toEqual({ type: "disabled" })
  })
})