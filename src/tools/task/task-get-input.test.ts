import { describe, test, expect } from "bun:test"
import { TaskGetInputSchema } from "./types"

describe("TaskGetInputSchema", () => {
  test("validates get input with id", () => {
    //#given
    const input = {
      id: "T-123",
    }

    //#when
    const result = TaskGetInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(true)
  })

  test("rejects get input without id", () => {
    //#given
    const input = {}

    //#when
    const result = TaskGetInputSchema.safeParse(input)

    //#then
    expect(result.success).toBe(false)
  })
})
