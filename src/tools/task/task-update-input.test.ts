import { describe, test, expect } from "bun:test"
import { TaskUpdateInputSchema } from "./types"

describe("TaskUpdateInputSchema", () => {
  test("validates update input with id and subject", () => {
    //#given
    const input = {
      id: "T-123",
      subject: "Updated subject",
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates update input with id only", () => {
    //#given
    const input = {
      id: "T-123",
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("rejects update input without id", () => {
    //#given
    const input = {
      subject: "Updated subject",
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(false)
  })

  test("validates update with status change", () => {
    //#given
    const input = {
      id: "T-123",
      status: "in_progress" as const,
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates update with blockedBy change", () => {
    //#given
    const input = {
      id: "T-123",
      blockedBy: ["T-456", "T-789"],
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates update with blocks change", () => {
    //#given
    const input = {
      id: "T-123",
      blocks: ["T-456"],
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates update with multiple fields", () => {
    //#given
    const input = {
      id: "T-123",
      subject: "Updated subject",
      description: "Updated description",
      status: "completed" as const,
      owner: "new-owner",
    }

    //#when
    const result = TaskUpdateInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })
})
