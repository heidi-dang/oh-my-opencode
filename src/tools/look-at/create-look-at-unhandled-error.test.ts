import { describe, expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { createLookAt } from "./tools"

describe("createLookAt unhandled error resilience", () => {
  const createToolContext = (): ToolContext => ({
    sessionID: "parent-session",
    messageID: "parent-message",
    agent: "sisyphus",
    directory: "/project",
    worktree: "/project",
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
  })

  // given session.create throws (network error, not error response)
  // when LookAt tool executed
  // then returns error string instead of crashing
  test("catches session.create throw and returns error string", async () => {
    const mockClient = {
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => { throw new Error("ECONNREFUSED: connection refused") },
      },
    }

    const tool = createLookAt({
      client: mockClient,
      directory: "/project",
    } as any)

    const result = await tool.execute(
      { file_path: "/test/file.png", goal: "analyze" },
      createToolContext(),
    )
    expect(result).toContain("Error")
    expect(result).toContain("ECONNREFUSED")
  })

  // given session.messages throws unexpectedly
  // when LookAt tool executed
  // then returns error string instead of crashing
  test("catches session.messages throw and returns error string", async () => {
    const mockClient = {
      app: {
        agents: async () => ({ data: [] }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_msg_throw" } }),
        prompt: async () => ({}),
        messages: async () => { throw new Error("Unexpected server error") },
      },
    }

    const tool = createLookAt({
      client: mockClient,
      directory: "/project",
    } as any)

    const result = await tool.execute(
      { file_path: "/test/file.png", goal: "analyze" },
      createToolContext(),
    )
    expect(result).toContain("Error")
    expect(result).toContain("Unexpected server error")
  })

  // given a non-Error object is thrown
  // when LookAt tool executed
  // then still returns error string
  test("handles non-Error thrown objects gracefully", async () => {
    const mockClient = {
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => { throw "string error thrown" },
      },
    }

    const tool = createLookAt({
      client: mockClient,
      directory: "/project",
    } as any)

    const result = await tool.execute(
      { file_path: "/test/file.png", goal: "analyze" },
      createToolContext(),
    )
    expect(result).toContain("Error")
    expect(result).toContain("string error thrown")
  })
})
