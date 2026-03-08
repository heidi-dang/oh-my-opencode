import { describe, test, expect } from "bun:test"

/**
 * Regression tests for completion verification in sync-task flow.
 * 
 * These tests verify that:
 * 1. When verifyTaskCompletionState returns false, task does NOT complete
 * 2. The fallback assistant-text completion path is removed
 * 3. Only verified complete_task allows completion
 * 4. requireCompleteTask option works correctly
 */

describe("sync-task completion verification regression", () => {
  test("verifyTaskCompletionState with requireCompleteTask: true returns false when no complete_task", async () => {
    const { verifyTaskCompletionState } = await import("../../shared/verify-task-completion")
    
    // Mock client that simulates a session where complete_task was NOT called
    const mockClient = {
      session: {
        messages: async () => ({
          data: [
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Here is the result you asked for." }]
            }
          ]
        })
      }
    }
    
    // verifyTaskCompletionState with requireCompleteTask: true should return false when no complete_task found
    const result = await verifyTaskCompletionState(mockClient as any, "test-session", { requireCompleteTask: true })
    expect(result).toBe(false)
  })
  
  test("verifyTaskCompletionState with requireCompleteTask: true returns true when successful complete_task", async () => {
    const { verifyTaskCompletionState } = await import("../../shared/verify-task-completion")
    
    // Mock client with successful complete_task
    const mockClient = {
      session: {
        messages: async () => ({
          data: [
            {
              info: { role: "assistant" },
              parts: [{
                type: "tool",
                toolName: "complete_task",
                state: {
                  status: "completed",
                  output: "[RUNTIME AUTHORIZATION]\n\nTASK COMPLETE."
                }
              }]
            }
          ]
        })
      }
    }
    
    const result = await verifyTaskCompletionState(mockClient as any, "test-session", { requireCompleteTask: true })
    expect(result).toBe(true)
  })
  
  test("verifyTaskCompletionState returns false when complete_task was rejected", async () => {
    const { verifyTaskCompletionState } = await import("../../shared/verify-task-completion")
    
    // Mock client with rejected complete_task
    const mockClient = {
      session: {
        messages: async () => ({
          data: [
            {
              info: { role: "assistant" },
              parts: [{
                type: "tool",
                toolName: "complete_task",
                state: {
                  status: "completed",
                  output: "[ERROR] TASK COMPLETION REJECTED\n\nYou have incomplete TODOs"
                }
              }]
            }
          ]
        })
      }
    }
    
    const result = await verifyTaskCompletionState(mockClient as any, "test-session", { requireCompleteTask: true })
    expect(result).toBe(false)
  })
  
  test("verifyTaskCompletionState fails closed on SDK error", async () => {
    const { verifyTaskCompletionState } = await import("../../shared/verify-task-completion")
    
    // Mock client that throws
    const mockClient = {
      session: {
        messages: async () => { throw new Error("SDK network error") }
      }
    }
    
    // Should fail-closed (return false), not fail-open
    const result = await verifyTaskCompletionState(mockClient as any, "test-session")
    expect(result).toBe(false)
  })
})
