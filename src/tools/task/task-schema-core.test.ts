import { describe, test, expect } from "bun:test"
import { TaskSchema } from "./types"

describe("TaskSchema", () => {
  test("validates complete task object with all fields", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      activeForm: "Implementing feature",
      blocks: ["T-456"],
      blockedBy: ["T-789"],
      owner: "agent-name",
      metadata: { priority: "high" },
      repoURL: "https://github.com/example/repo",
      parentID: "T-parent",
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(true)
  })

  test("validates task with only required fields", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blocks: [],
      blockedBy: [],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(true)
  })

  test("rejects task missing required subject field", () => {
    //#given
    const task = {
      id: "T-123",
      description: "Detailed description",
      status: "pending" as const,
      blocks: [],
      blockedBy: [],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(false)
  })

  test("rejects task with invalid status", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "open",
      blocks: [],
      blockedBy: [],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(false)
  })

  test("validates blocks as array of strings", () => {
    //#given
    const task = {
      id: "T-123",
      subject: "Implement feature",
      description: "Detailed description",
      status: "pending" as const,
      blocks: ["T-456", "T-789"],
      blockedBy: [],
      threadID: "thread-123",
    }

    //#when
    const result = TaskSchema.safeParse(task)

    //#then
    expect(result.success).toBe(true)
  })
})
