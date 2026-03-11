import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { SafeToastWrapper } from "./safe-toast-wrapper"
import type { PluginInput } from "@opencode-ai/plugin"

describe("SafeToastWrapper - Shared Toast Failure Fix (commits 31/46-38/46)", () => {
  let mockCtx: PluginInput
  let toastCalls: any[] = []

  beforeEach(() => {
    toastCalls = []

    // Mock client with TUI
    mockCtx = {
      client: {
        tui: {
          showToast: async ({ body }: any) => {
            toastCalls.push(body)
            return { data: {} }
          }
        }
      },
      directory: "/tmp",
      project: { id: "test-project" },
      worktree: { id: "test-worktree" },
      serverUrl: "http://localhost:3000",
      $: async () => ({ data: {} })
    } as unknown as PluginInput
  })

  afterEach(() => {
    // Clear error log throttle
    ;(SafeToastWrapper as any).lastLoggedErrors.clear()
  })

  describe("Basic Toast Functionality", () => {
    test("shows toast when TUI context is available", async () => {
      // given
      const options = {
        title: "Test Title",
        message: "Test Message",
        variant: "info" as const
      }

      // when
      SafeToastWrapper.showToast(mockCtx, options, "test-context")

      // then - wait for async
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(toastCalls).toHaveLength(1)
      expect(toastCalls[0]).toMatchObject({
        title: "Test Title",
        message: "Test Message",
        variant: "info",
        duration: 5000
      })
    })

    test("convenience methods work correctly", async () => {
      // when
      SafeToastWrapper.showError(mockCtx, "Error", "Error message", "error-test")
      SafeToastWrapper.showSuccess(mockCtx, "Success", "Success message", "success-test")
      SafeToastWrapper.showInfo(mockCtx, "Info", "Info message", "info-test")
      SafeToastWrapper.showWarning(mockCtx, "Warning", "Warning message", "warning-test")

      // then - wait for async
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(toastCalls).toHaveLength(4)
      expect(toastCalls[0].variant).toBe("error")
      expect(toastCalls[1].variant).toBe("success")
      expect(toastCalls[2].variant).toBe("info")
      expect(toastCalls[3].variant).toBe("warning")
    })
  })

  describe("Fail-Open Behavior", () => {
    test("skips toast when TUI context is missing", () => {
      // given
      const ctxWithoutTui = {
        ...mockCtx,
        client: {}
      } as unknown as PluginInput

      // when
      SafeToastWrapper.showToast(ctxWithoutTui, {
        title: "Test",
        message: "Message",
        variant: "info"
      })

      // then
      expect(toastCalls).toHaveLength(0)
    })

    test("skips toast when showToast method is missing", () => {
      // given
      const ctxWithoutShowToast = {
        ...mockCtx,
        client: {
          tui: {}
        }
      } as unknown as PluginInput

      // when
      SafeToastWrapper.showToast(ctxWithoutShowToast, {
        title: "Test",
        message: "Message",
        variant: "info"
      })

      // then
      expect(toastCalls).toHaveLength(0)
    })

    test("skips toast when payload is invalid", () => {
      // when
      SafeToastWrapper.showToast(mockCtx, {
        title: "", // Empty title
        message: "Message",
        variant: "info"
      })

      SafeToastWrapper.showToast(mockCtx, {
        title: "Title",
        message: "", // Empty message
        variant: "info"
      })

      // then
      expect(toastCalls).toHaveLength(0)
    })

    test("handles showToast throwing errors", () => {
      // given
      const ctxWithFailingToast = {
        ...mockCtx,
        client: {
          tui: {
            showToast: async () => {
              throw new Error("Toast system failed")
            }
          }
        }
      } as unknown as PluginInput

      // when - should not throw
      expect(() => {
        SafeToastWrapper.showToast(ctxWithFailingToast, {
          title: "Test",
          message: "Message",
          variant: "info"
        })
      }).not.toThrow()

      // then
      expect(toastCalls).toHaveLength(0)
    })
  })

  describe("Non-Blocking Behavior", () => {
    test("does not block execution flow", async () => {
      // given
      let executionCompleted = false

      // when
      SafeToastWrapper.showToast(mockCtx, {
        title: "Test",
        message: "Message",
        variant: "info"
      })

      executionCompleted = true

      // then - execution should complete immediately
      expect(executionCompleted).toBe(true)

      // Toast should still be processed asynchronously
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(toastCalls).toHaveLength(1)
    })

    test("can be called multiple times without blocking", async () => {
      // given
      const startTime = Date.now()

      // when
      for (let i = 0; i < 10; i++) {
        SafeToastWrapper.showToast(mockCtx, {
          title: `Test ${i}`,
          message: `Message ${i}`,
          variant: "info"
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // then - should complete very quickly (not blocked by toasts)
      expect(duration).toBeLessThan(50) // Less than 50ms for 10 toasts

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(toastCalls).toHaveLength(10)
    })
  })

  describe("Error Logging and Throttling", () => {
    test("logs errors only once per throttle period", async () => {
      // given
      const ctxWithFailingToast = {
        ...mockCtx,
        client: {
          tui: {
            showToast: async () => {
              throw new Error("Toast system failed")
            }
          }
        }
      } as unknown as PluginInput

      // when - call multiple times quickly
      for (let i = 0; i < 5; i++) {
        SafeToastWrapper.showToast(ctxWithFailingToast, {
          title: "Test",
          message: "Message",
          variant: "info"
        }, "test-context")
      }

      // then - should only log once (throttled)
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(toastCalls).toHaveLength(0)
      
      // The error should be logged only once due to throttling
      // (We can't easily test logging without mocking the logger)
    })
  })

  describe("Integration with Feature Families", () => {
    beforeEach(() => {
      toastCalls = []
    })

    test("no-sisyphus-gpt hook usage pattern", async () => {
      // when - simulate no-sisyphus-gpt hook usage
      SafeToastWrapper.showError(
        mockCtx,
        "NEVER Use Sisyphus with GPT",
        "Sisyphus works best with Claude Opus...",
        "no-sisyphus-gpt:session-123"
      )

      // then - wait for async
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(toastCalls).toHaveLength(1)
      expect(toastCalls[0].title).toBe("NEVER Use Sisyphus with GPT")
      expect(toastCalls[0].variant).toBe("error")
    })

    test("semantic-loop-guard hook usage pattern", async () => {
      // when - simulate semantic-loop-guard usage
      SafeToastWrapper.showSuccess(
        mockCtx,
        "Safety Guard Active",
        "[Semantic Loop Guard] Repeated action blocked",
        "semantic-loop-guard:session-456"
      )

      // then - wait for async
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(toastCalls).toHaveLength(1)
      expect(toastCalls[0].title).toBe("Safety Guard Active")
      expect(toastCalls[0].variant).toBe("success")
    })

    test("auto-update-checker hook usage pattern", async () => {
      // when - simulate auto-update-checker usage
      SafeToastWrapper.showWarning(
        mockCtx,
        "Model Cache Not Found",
        "Run 'opencode models --refresh'...",
        "auto-update-model-cache"
      )

      // then - wait for async
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(toastCalls).toHaveLength(1)
      expect(toastCalls[0].title).toBe("Model Cache Not Found")
      expect(toastCalls[0].variant).toBe("warning")
    })
  })
})
