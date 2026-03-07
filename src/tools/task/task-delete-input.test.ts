import { describe, test, expect } from "bun:test"
import { TaskDeleteInputSchema } from "./types"

describe("TaskDeleteInputSchema", () => {
  test("validates delete input with id", () => {
    //#given
    const input = {
      id: "T-123",
    }

    //#when
    const result = TaskDeleteInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("rejects delete input without id", () => {
    //#given
    const input = {}

    //#when
    const result = TaskDeleteInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(false)
  })
})
