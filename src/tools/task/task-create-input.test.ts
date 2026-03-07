import { describe, test, expect } from "bun:test"
import { TaskCreateInputSchema } from "./types"

describe("TaskCreateInputSchema", () => {
  test("validates create input with required subject", () => {
    //#given
    const input = {
      subject: "Implement feature",
    }

    //#when
    const result = TaskCreateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates create input with all optional fields", () => {
    //#given
    const input = {
      subject: "Implement feature",
      description: "Detailed description",
      blockedBy: ["T-456"],
      blocks: ["T-789"],
      activeForm: "Implementing feature",
      owner: "agent-name",
      metadata: { priority: "high" },
      repoURL: "https://github.com/example/repo",
      parentID: "T-parent",
    }

    //#when
    const result = TaskCreateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("rejects create input without subject", () => {
    //#given
    const input = {
      description: "Detailed description",
    }

    //#when
    const result = TaskCreateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(false)
  })

  test("accepts blockedBy as array of strings", () => {
    //#given
    const input = {
      subject: "Implement feature",
      blockedBy: ["T-456", "T-789"],
    }

    //#when
    const result = TaskCreateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("accepts blocks as array of strings", () => {
    //#given
    const input = {
      subject: "Implement feature",
      blocks: ["T-456", "T-789"],
    }

    //#when
    const result = TaskCreateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })
})
