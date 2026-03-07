import { describe, test, expect } from "bun:test"
import { TaskListInputSchema } from "./types"

describe("TaskListInputSchema", () => {
  test("validates empty list input", () => {
    //#given
    const input = {}

    //#when
    const result = TaskListInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates list input with status filter", () => {
    //#given
    const input = {
      status: "pending" as const,
    }

    //#when
    const result = TaskListInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates list input with parentID filter", () => {
    //#given
    const input = {
      parentID: "T-parent",
    }

    //#when
    const result = TaskListInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates list input with both filters", () => {
    //#given
    const input = {
      status: "in_progress" as const,
      parentID: "T-parent",
    }

    //#when
    const result = TaskListInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })
})
