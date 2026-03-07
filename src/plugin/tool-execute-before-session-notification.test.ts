import { describe, expect, test, spyOn } from "bun:test"

const sessionState = require("../features/claude-code-session-state")
const { createToolExecuteBeforeHandler } = require("./tool-execute-before")

describe("createToolExecuteBeforeHandler session notification sessionID", () => {
  test("uses main session fallback when input sessionID is empty", async () => {
    const mainSessionID = "ses_main"
    const getMainSessionIDSpy = spyOn(sessionState, "getMainSessionID").mockReturnValue(mainSessionID)

    let capturedSessionID: string | undefined
    const hooks = {
      sessionNotification: async (input: unknown) => {
        capturedSessionID = (input as any).event.properties?.sessionID
      },
    }

    const handler = createToolExecuteBeforeHandler({
      ctx: { client: { session: { messages: async () => ({ data: [] }) } } },
      hooks,
    })

    await handler(
      { tool: "question", sessionID: "", callID: "call_q" },
      { args: { questions: [{ question: "Continue?", options: [{ label: "Yes" }] }] } },
    )

    expect(getMainSessionIDSpy).toHaveBeenCalled()
    expect(capturedSessionID).toBe(mainSessionID)
  })
})

export {}
