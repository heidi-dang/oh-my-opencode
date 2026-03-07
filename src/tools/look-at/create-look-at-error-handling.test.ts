import { describe, expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { createLookAt } from "./tools"

describe("createLookAt error handling", () => {
  // given sync prompt throws and no messages available
  // when LookAt tool executed
  // then returns no-response error (fetches messages after catching prompt error)
  test("returns no-response error when prompt fails and no messages exist", async () => {
    const mockClient = {
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_test_prompt_fail" } }),
        prompt: async () => { throw new Error("Network connection failed") },
        messages: async () => ({ data: [] }),
      },
    }

    const tool = createLookAt({
      client: mockClient,
      directory: "/project",
    } as any)

    const toolContext: ToolContext = {
      sessionID: "parent-session",
      messageID: "parent-message",
      agent: "sisyphus",
      directory: "/project",
      worktree: "/project",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    }

    const result = await tool.execute(
      { file_path: "/test/file.png", goal: "analyze image" },
      toolContext,
    )
    expect(result).toContain("Error")
    expect(result).toContain("multimodal-looker")
  })

  // given sync prompt succeeds
  // when LookAt tool executed and no assistant message found
  // then returns error about no response
  test("returns error when no assistant message after successful prompt", async () => {
    const mockClient = {
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_test_no_msg" } }),
        prompt: async () => ({}),
        messages: async () => ({ data: [] }),
      },
    }

    const tool = createLookAt({
      client: mockClient,
      directory: "/project",
    } as any)

    const toolContext: ToolContext = {
      sessionID: "parent-session",
      messageID: "parent-message",
      agent: "sisyphus",
      directory: "/project",
      worktree: "/project",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    }

    const result = await tool.execute(
      { file_path: "/test/file.pdf", goal: "extract text" },
      toolContext,
    )
    expect(result).toContain("Error")
    expect(result).toContain("multimodal-looker")
  })

  // given session creation fails
  // when LookAt tool executed
  // then returns error about session creation
  test("returns error when session creation fails", async () => {
    const mockClient = {
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ error: "Internal server error" }),
        prompt: async () => ({}),
        messages: async () => ({ data: [] }),
      },
    }

    const tool = createLookAt({
      client: mockClient,
      directory: "/project",
    } as any)

    const toolContext: ToolContext = {
      sessionID: "parent-session",
      messageID: "parent-message",
      agent: "sisyphus",
      directory: "/project",
      worktree: "/project",
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    }

    const result = await tool.execute(
      { file_path: "/test/file.png", goal: "analyze" },
      toolContext,
    )
    expect(result).toContain("Error")
    expect(result).toContain("session")
  })
})
