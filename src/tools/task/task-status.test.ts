import { describe, test, expect } from "bun:test"
import { TaskStatusSchema } from "./types"

describe("TaskStatusSchema", () => {
  test("accepts valid status values", () => {
    //#given
    const validStatuses = ["pending", "in_progress", "completed", "deleted"]

    //#when
    const results = validStatuses.map((status) => TaskStatusSchema.safeParse(status))

    //#then
    expect(results.every((r) => r.success)).toBe(true)
  })

  test("rejects invalid status values", () => {
    //#given
    const invalidStatuses = ["open", "done", "archived", "unknown"]

    //#when
    const results = invalidStatuses.map((status) => TaskStatusSchema.safeParse(status))

    //#then
    expect(results.every((r) => !r.success)).toBe(true)
  })
})
