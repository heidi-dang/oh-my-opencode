import { describe, expect, test, mock } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { createLookAt } from "./tools"

describe("createLookAt sync prompt (race condition fix)", () => {
  // given look_at needs response immediately after prompt returns
  // when tool is executed
  // then must use synchronous prompt (session.prompt), NOT async (session.promptAsync)
  test("uses synchronous prompt to avoid race condition with polling", async () => {
    const syncPrompt = mock(async () => ({}))
    const asyncPrompt = mock(async () => ({}))
    const statusFn = mock(async () => ({ data: {} }))

    const mockClient = {
      app: {
        agents: async () => ({ data: [] }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_sync_test" } }),
        prompt: syncPrompt,
        promptAsync: asyncPrompt,
        status: statusFn,
        messages: async () => ({
          data: [
            { info: { role: "assistant", time: { created: 1 } }, parts: [{ type: "text", text: "result" }] },
          ],
        }),
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

    expect(result).toBe("result")
    expect(syncPrompt).toHaveBeenCalledTimes(1)
    expect(asyncPrompt).not.toHaveBeenCalled()
    expect(statusFn).not.toHaveBeenCalled()
  })

  // given sync prompt throws (JSON parse error even on success)
  // when tool is executed
  // then catches error gracefully and still fetches messages
  test("catches sync prompt errors and still fetches messages", async () => {
    const mockClient = {
      app: {
        agents: async () => ({ data: [] }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_sync_error" } }),
        prompt: async () => { throw new Error("JSON parse error") },
        promptAsync: async () => ({}),
        status: async () => ({ data: {} }),
        messages: async () => ({
          data: [
            { info: { role: "assistant", time: { created: 1 } }, parts: [{ type: "text", text: "result despite error" }] },
          ],
        }),
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

    expect(result).toBe("result despite error")
  })

  // given sync prompt throws and no messages available
  // when tool is executed
  // then returns error about no response
  test("returns no-response error when sync prompt fails and no messages", async () => {
    const mockClient = {
      app: {
        agents: async () => ({ data: [] }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_sync_no_msg" } }),
        prompt: async () => { throw new Error("Connection refused") },
        promptAsync: async () => ({}),
        status: async () => ({ data: {} }),
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
    expect(result).toContain("multimodal-looker")
  })
})
