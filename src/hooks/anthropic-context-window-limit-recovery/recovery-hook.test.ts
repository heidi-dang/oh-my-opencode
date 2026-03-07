import { afterEach, beforeEach, describe, expect, mock, test, spyOn } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import * as executor from "./executor"
import * as parser from "./parser"
import * as logger from "../../shared/logger"

let executeCompactMock: any
let getLastAssistantMock: any
let parseAnthropicTokenLimitErrorMock: any

function createMockContext(): PluginInput {
  return {
    client: {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
      },
      tui: {
        showToast: mock(() => Promise.resolve()),
      },
    },
    directory: "/tmp",
  } as PluginInput
}

function setupDelayedTimeoutMocks(): {
  restore: () => void
  getClearTimeoutCalls: () => Array<ReturnType<typeof setTimeout>>
} {
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const clearTimeoutCalls: Array<ReturnType<typeof setTimeout>> = []
  let timeoutCounter = 0

  globalThis.setTimeout = ((_: () => void, _delay?: number) => {
    timeoutCounter += 1
    return timeoutCounter as ReturnType<typeof setTimeout>
  }) as typeof setTimeout

  globalThis.clearTimeout = ((timeoutID: ReturnType<typeof setTimeout>) => {
    clearTimeoutCalls.push(timeoutID)
  }) as typeof clearTimeout

  return {
    restore: () => {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    },
    getClearTimeoutCalls: () => clearTimeoutCalls,
  }
}

describe("createAnthropicContextWindowLimitRecoveryHook", () => {
  beforeEach(() => {
    executeCompactMock = spyOn(executor, "executeCompact").mockResolvedValue(undefined as any)
    getLastAssistantMock = spyOn(executor, "getLastAssistant").mockResolvedValue({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-6",
    } as any)
    parseAnthropicTokenLimitErrorMock = spyOn(parser, "parseAnthropicTokenLimitError").mockReturnValue({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-6",
    } as any)
    spyOn(logger, "log").mockImplementation(() => { })
  })

  afterEach(() => {
    mock.restore()
  })

  test("cancels pending timer when session.idle handles compaction first", async () => {
    //#given
    const { restore, getClearTimeoutCalls } = setupDelayedTimeoutMocks()
    const { createAnthropicContextWindowLimitRecoveryHook } = await import("./recovery-hook")
    const hook = createAnthropicContextWindowLimitRecoveryHook(createMockContext())

    try {
      //#when
      await hook.event({
        event: {
          type: "session.error",
          properties: { sessionID: "session-race", error: "prompt is too long" },
        },
      })

      await hook.event({
        event: {
          type: "session.idle",
          properties: { sessionID: "session-race" },
        },
      })

      //#then
      expect(getClearTimeoutCalls()).toEqual([1 as ReturnType<typeof setTimeout>])
      expect(executeCompactMock).toHaveBeenCalledTimes(1)
      expect(executeCompactMock.mock.calls[0]?.[0]).toBe("session-race")
    } finally {
      restore()
    }
  })
})
