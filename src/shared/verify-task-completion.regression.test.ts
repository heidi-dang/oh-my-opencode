import { describe, test, expect, beforeEach, mock } from "bun:test"
import { verifyTaskCompletionState } from "./verify-task-completion"

describe("verifyTaskCompletionState - fail-closed regression", () => {
  beforeEach(() => {
    // Bun test doesn't have clearAllMocks exactly like vitest, but we can reset mocks if needed
  })

  test("should return false when SDK throws an error (fail-closed)", async () => {
    // Given - client that throws when calling session.messages
    const mockClient = {
      session: {
        messages: mock(async () => { throw new Error("SDK network error") }),
      },
    }

    // When
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")

    // Then - should fail-close (return false), not fail-open (return true)
    expect(result).toBe(false)
  })

  test("should return false when session.messages returns malformed data", async () => {
    // Given - client that returns invalid data
    const mockClient = {
      session: {
        messages: mock(async () => null),
      },
    }

    // When
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")

    // Then - should fail-close
    expect(result).toBe(false)
  })

  test("should return false when complete_task was rejected", async () => {
    // Given - client with a rejected complete_task
    const mockClient = {
      session: {
        messages: mock(async () => [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "tool",
                toolName: "complete_task",
                state: {
                  status: "completed",
                  output: "[ERROR] TASK COMPLETION REJECTED\n\nYou have 2 incomplete TODOs remaining",
                },
              },
            ],
          },
        ]),
      },
    }

    // When
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")

    // Then - should detect rejection
    expect(result).toBe(false)
  })

  test("should return false when complete_task failed with STRICT ISSUE RESOLUTION MODE", async () => {
    // Given - client with issue mode rejection
    const mockClient = {
      session: {
        messages: mock(async () => [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "tool",
                toolName: "complete_task",
                state: {
                  status: "completed",
                  output: "[ERROR] STRICT ISSUE RESOLUTION MODE ACTIVE.\n\nCurrent Verification State:\n- Reproduced: false",
                },
              },
            ],
          },
        ]),
      },
    }

    // When
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")

    // Then - should detect issue mode rejection
    expect(result).toBe(false)
  })

  test("should return true when complete_task succeeded", async () => {
    // Given - client with successful complete_task
    const mockClient = {
      session: {
        messages: mock(async () => [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "tool",
                toolName: "complete_task",
                state: {
                  status: "completed",
                  output: "[RUNTIME AUTHORIZATION]\n\nTASK COMPLETE.\n\nRuntime Verified Actions",
                },
              },
            ],
          },
        ]),
      },
    }

    // When
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")

    // Then - should allow completion
    expect(result).toBe(true)
  })

  test("should return true when no complete_task was called (clean session)", async () => {
    // Given - client with no complete_task calls
    const mockClient = {
      session: {
        messages: mock(async () => [
          {
            info: { role: "assistant" },
            parts: [{ type: "text", text: "Here's the file you asked for." }],
          },
        ]),
      },
    }

    // When
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")

    // Then - should allow (no rejection to consider)
    expect(result).toBe(true)
  })
})

