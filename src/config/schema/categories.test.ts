import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { CategoryConfigSchema } from "./categories"

describe("CategoryConfigSchema Nesting Validation", () => {
  test("forbids background_task inside category config", () => {
    const invalidConfig = {
      model: "openai/gpt-4",
      background_task: {
        defaultConcurrency: 5
      }
    }

    const result = CategoryConfigSchema.safeParse(invalidConfig)

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path[0] === "background_task")
      expect(issue).toBeDefined()
      expect(issue?.message).toContain("expected never")
    }
  })

  test("allows valid category config without background_task", () => {
    const validConfig = {
      model: "openai/gpt-4",
      description: "Test category"
    }

    const result = CategoryConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
  })
})
