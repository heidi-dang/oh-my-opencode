import { describe, test, expect } from "bun:test"
import { TaskSchema } from "./types"

describe("TaskSchema", () => {
  test("validates blockedBy as array of strings", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blocks: [],
      blockedBy: ["T-456", "T-789"],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates metadata as record of unknown values", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blocks: [],
      blockedBy: [],
      metadata: {
        priority: "high",
        tags: ["urgent", "backend"],
        count: 42,
        nested: { key: "value" },
      },
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(true)
  })

  test("rejects extra fields with strict mode", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blocks: [],
      blockedBy: [],
      threadID: "thread-123",
      extraField: "should not be here",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(false)
  })

  test("defaults blocks to empty array", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blockedBy: [],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    if (result.success) {
      expect(result.data.blocks).toEqual([])
    }
  })

  test("defaults blockedBy to empty array", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blocks: [],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    if (result.success) {
      expect(result.data.blockedBy).toEqual([])
    }
  })
})
