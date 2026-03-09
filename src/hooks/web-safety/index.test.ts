import { describe, expect, it } from "bun:test"
import { createWebSafetyHook, WEB_FAILURE_COLLAPSE_REMINDER } from "./hook"

describe("WebSafetyHook", () => {
  const mockCtx = {} as any

  it("#given a 404 error from an external tool #then it should immediately inject the collapse reminder", async () => {
    const hook = createWebSafetyHook(mockCtx)
    const input = { tool: "webfetch", sessionID: "session-1", callID: "call-1" }
    const output = { title: "Title", output: "Error 404: Not Found", metadata: {} }

    await hook["tool.execute.after"](input, output)

    expect(output.output).toContain(WEB_FAILURE_COLLAPSE_REMINDER)
  })

  it("#given multiple consecutive failures from an external tool #then it should inject the collapse reminder on the threshold", async () => {
    const hook = createWebSafetyHook(mockCtx)
    const sessionID = "session-2"
    const input = { tool: "gh_safe", sessionID, callID: "call-1" }
    
    // First failure
    const output1 = { title: "Title", output: "GH execution failed: connection timeout", metadata: {} }
    await hook["tool.execute.after"](input, output1)
    expect(output1.output).not.toContain(WEB_FAILURE_COLLAPSE_REMINDER)

    // Second failure
    const output2 = { title: "Title", output: "GH execution failed: connection timeout", metadata: {} }
    await hook["tool.execute.after"](input, output2)
    expect(output2.output).toContain(WEB_FAILURE_COLLAPSE_REMINDER)
  })

  it("#given a success output #then it should not inject the reminder", async () => {
    const hook = createWebSafetyHook(mockCtx)
    const input = { tool: "webfetch", sessionID: "session-3", callID: "call-1" }
    const output = { title: "Title", output: "Content from website", metadata: {} }

    await hook["tool.execute.after"](input, output)

    expect(output.output).not.toContain(WEB_FAILURE_COLLAPSE_REMINDER)
  })

  it("#given a non-external tool failure #then it should ignore it", async () => {
    const hook = createWebSafetyHook(mockCtx)
    const input = { tool: "read_file", sessionID: "session-4", callID: "call-1" }
    const output = { title: "Title", output: "Error 404: File not found", metadata: {} }

    await hook["tool.execute.after"](input, output)

    expect(output.output).not.toContain(WEB_FAILURE_COLLAPSE_REMINDER)
  })
})
