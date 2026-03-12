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
    expect(config.prompt).toContain('task(subagent_type="ui-ux-specialist", load_skills=[], ...)')
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
    expect(config.prompt).toContain("ui-ux-specialist")
  })

  test("renders dynamic available agents in the prompt", () => {
    // given
    const model = "github-copilot/gpt-5-mini"

    // when
    const config = createHeidiAgent(
      model,
      [
        {
          name: "ui-ux-specialist",
          description: "Frontend design specialist",
          metadata: {
            category: "specialist",
            cost: "EXPENSIVE",
            triggers: [{ domain: "Frontend UI/UX", trigger: "Visual redesigns" }],
            promptAlias: "UI/UX Specialist",
            keyTrigger: "Frontend redesign → fire ui-ux-specialist",
          },
        },
        {
          name: "oracle",
          description: "Read-only architecture advisor",
          metadata: {
            category: "advisor",
            cost: "EXPENSIVE",
            triggers: [{ domain: "Architecture", trigger: "High-difficulty design decisions" }],
          },
        },
      ],
      ["read_file", "grep_search"],
      [
        { name: "frontend-ui-ux", description: "Frontend work", location: "plugin" },
      ],
      [
        { name: "visual-engineering", description: "Frontend UI/UX" },
      ],
    )

    // then
    expect(config.prompt).toContain("Available Specialists")
    expect(config.prompt).toContain("Frontend design specialist")
    expect(config.prompt).toContain("oracle")
    expect(config.prompt).toContain("visual-engineering")
    expect(config.prompt).toContain("Frontend redesign → fire ui-ux-specialist")
  })
})