import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { BackgroundManager } from "./manager"
import type { PluginInput } from "@opencode-ai/plugin"
import { tmpdir } from "os"
import { getTaskToastManager, initTaskToastManager } from "../task-toast-manager"

describe("BackgroundManager - Runtime Foundation Repair (commits 15/46-30/46)", () => {
  let manager: BackgroundManager
  let mockClient: any
  let abortCalls: any[] = []
  let toastCalls: any[] = []

  beforeEach(() => {
    abortCalls = []
    toastCalls = []

    // Create a mock client that tracks abort and toast calls
    mockClient = {
      session: {
        abort: async ({ path }: { path: { id: string } }) => {
          abortCalls.push({ sessionId: path.id })
          return { data: {} }
        },
        promptAsync: async ({ path, body }: any) => {
          return { data: {} }
        },
        get: async ({ path }: { path: { id: string } }) => {
          return { data: { status: "running" } }
        },
        messages: async () => ({ data: [] }),
      },
      tui: {
        showToast: async ({ body }: any) => {
          toastCalls.push(body)
          return { data: {} }
        }
      }
    } as unknown as PluginInput["client"]

    manager = new BackgroundManager({
      client: mockClient,
      directory: tmpdir(),
    } as unknown as PluginInput)

    // Initialize toast manager
    initTaskToastManager(mockClient, undefined)
  })

  afterEach(() => {
    manager.shutdown()
  })

  describe("Toast/Notification Fail-Open During Cancellation", () => {
    test("toast removal failure should not prevent cancellation", async () => {
      // given
      const task = await manager.launch({
        description: "Test task",
        prompt: "Do something",
        agent: "test-agent",
        parentSessionID: "parent-session",
        parentMessageID: "parent-message",
      })

      // Simulate the task running
      const runningTask = manager.getTask(task.id)
      if (!runningTask) throw new Error("Task not found")
      ;(runningTask as any).status = "running"
      ;(runningTask as any).sessionID = "test-session"

      // Make toast manager fail
      const toastManager = getTaskToastManager()
      if (toastManager) {
        const originalRemove = toastManager.removeTask.bind(toastManager)
        toastManager.removeTask = () => {
          throw new Error("Toast system failed")
        }
      }

      // when - cancel the task
      const result = await manager.cancelTask(task.id, { source: "test" })

      // then - cancellation should still succeed despite toast failure
      expect(result).toBe(true)
      expect(runningTask.status).toBe("cancelled")
      expect(abortCalls).toHaveLength(1)
    })

    test("completion toast failure should not prevent task completion", async () => {
      // given
      const task = await manager.launch({
        description: "Test task",
        prompt: "Do something",
        agent: "test-agent",
        parentSessionID: "parent-session",
        parentMessageID: "parent-message",
      })

      // Simulate the task running
      const runningTask = manager.getTask(task.id)
      if (!runningTask) throw new Error("Task not found")
      ;(runningTask as any).status = "running"
      ;(runningTask as any).sessionID = "test-session"

      // Make toast manager fail
      const toastManager = getTaskToastManager()
      if (toastManager) {
        const originalShow = toastManager.showCompletionToast.bind(toastManager)
        toastManager.showCompletionToast = () => {
          throw new Error("Toast system failed")
        }
      }

      // Access private method for testing
      const tryCompleteTask = (manager as any).tryCompleteTask.bind(manager)

      // when - complete the task
      const result = await tryCompleteTask(runningTask, "test")

      // then - completion should still succeed despite toast failure
      expect(result).toBe(true)
      expect(runningTask.status).toBe("completed")
    })

    test("toast manager should handle all exceptions gracefully", async () => {
      // given
      const toastManager = getTaskToastManager()
      if (!toastManager) throw new Error("Toast manager not initialized")

      // when/then - all operations should be fail-safe
      expect(() => {
        toastManager.removeTask("non-existent-id")
      }).not.toThrow()

      expect(() => {
        toastManager.showCompletionToast({
          id: "test-id",
          description: "Test task",
          duration: "1s"
        })
      }).not.toThrow()
    })
  })

  describe("Auto-Execution State Gating", () => {
    test("should not auto-execute when session is cancelled", async () => {
      // given
      const { executeDeterministicStep } = await import("../../hooks/atlas/auto-executor")
      
      const mockCtx = {
        client: {
          session: {
            get: async ({ path }: { path: { id: string } }) => ({
              data: { status: "cancelled" }
            })
          }
        },
        directory: "/tmp"
      } as unknown as PluginInput

      // when
      const result = await executeDeterministicStep(
        mockCtx,
        "cancelled-session",
        "test-tool",
        { arg: "value" }
      )

      // then
      expect(result.success).toBe(false)
      expect(result.output).toBe("Auto-execution skipped: session cancelled")
    })

    test("should not auto-execute when session is in error state", async () => {
      // given
      const { executeDeterministicStep } = await import("../../hooks/atlas/auto-executor")
      
      const mockCtx = {
        client: {
          session: {
            get: async ({ path }: { path: { id: string } }) => ({
              data: { status: "error" }
            })
          }
        },
        directory: "/tmp"
      } as unknown as PluginInput

      // when
      const result = await executeDeterministicStep(
        mockCtx,
        "error-session",
        "test-tool",
        { arg: "value" }
      )

      // then
      expect(result.success).toBe(false)
      expect(result.output).toBe("Auto-execution skipped: session cancelled")
    })

    test("should not auto-execute when session get throws abort error", async () => {
      // given
      const { executeDeterministicStep } = await import("../../hooks/atlas/auto-executor")
      
      const mockCtx = {
        client: {
          session: {
            get: async () => {
              const error = new Error("Session aborted")
              error.name = "MessageAbortedError"
              throw error
            }
          }
        },
        directory: "/tmp"
      } as unknown as PluginInput

      // when
      const result = await executeDeterministicStep(
        mockCtx,
        "aborted-session",
        "test-tool",
        { arg: "value" }
      )

      // then
      expect(result.success).toBe(false)
      expect(result.output).toBe("Auto-execution skipped: session aborted")
    })

    test("should proceed with auto-execution when session is running", async () => {
      // given
      const { executeDeterministicStep } = await import("../../hooks/atlas/auto-executor")
      
      const mockCtx = {
        client: {
          session: {
            get: async ({ path }: { path: { id: string } }) => ({
              data: { status: "running" }
            })
          }
        },
        directory: "/tmp"
      } as unknown as PluginInput

      // when
      const result = await executeDeterministicStep(
        mockCtx,
        "running-session",
        "non-existent-tool",
        { arg: "value" }
      )

      // then - should fail due to tool not existing, but not due to cancellation
      expect(result.success).toBe(false)
      expect(result.output).toContain("Unsupported or unauthorized tool")
    })
  })

  describe("Integration: Cancel then Auto-Execute", () => {
    test("auto-execution should be blocked after cancellation", async () => {
      // given
      const task = await manager.launch({
        description: "Test task",
        prompt: "Do something",
        agent: "test-agent",
        parentSessionID: "parent-session",
        parentMessageID: "parent-message",
      })

      // Cancel the task
      await manager.cancelTask(task.id, { source: "test" })

      // Mock session.get to return cancelled status
      mockClient.session.get = async ({ path }: { path: { id: string } }) => ({
        data: { status: "cancelled" }
      })

      // when - try to auto-execute on the cancelled session
      const { executeDeterministicStep } = await import("../../hooks/atlas/auto-executor")
      const result = await executeDeterministicStep(
        { client: mockClient, directory: "/tmp" } as unknown as PluginInput,
        task.sessionID || "test-session",
        "test-tool"
      )

      // then
      expect(result.success).toBe(false)
      expect(result.output).toBe("Auto-execution skipped: session cancelled")
    })
  })

  describe("Bounded Cleanup Verification", () => {
    test("cancellation should complete in bounded time regardless of failures", async () => {
      // given
      const task = await manager.launch({
        description: "Test task",
        prompt: "Do something",
        agent: "test-agent",
        parentSessionID: "parent-session",
        parentMessageID: "parent-message",
      })

      // Make both toast and notification fail
      const toastManager = getTaskToastManager()
      if (toastManager) {
        toastManager.removeTask = () => {
          throw new Error("Toast failed")
        }
        toastManager.showCompletionToast = () => {
          throw new Error("Toast failed")
        }
      }

      // when - cancel with timeout
      const startTime = Date.now()
      const result = await Promise.race([
        manager.cancelTask(task.id, { source: "test" }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Cancellation timed out")), 1000)
        )
      ])
      const duration = Date.now() - startTime

      // then
      expect(result).toBe(true)
      expect(duration).toBeLessThan(1000) // Should complete well under 1 second
    })
  })
})
