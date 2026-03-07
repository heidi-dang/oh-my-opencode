import { describe, expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { createLookAt } from "./tools"

describe("createLookAt model passthrough", () => {
  // given multimodal-looker agent has resolved model info
  // when LookAt tool executed
  // then model info should be passed to sync prompt
  test("passes multimodal-looker model to sync prompt when available", async () => {
    let promptBody: any

    const mockClient = {
      app: {
        agents: async () => ({
          data: [
            {
              name: "multimodal-looker",
              mode: "subagent",
              model: { providerID: "google", modelID: "gemini-3-flash" },
            },
          ],
        }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_model_passthrough" } }),
        prompt: async (input: any) => {
          promptBody = input.body
          return { data: {} }
        },
        messages: async () => ({
          data: [
            { info: { role: "assistant", time: { created: 1 } }, parts: [{ type: "text", text: "done" }] },
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
      directory: "/tmp",
      worktree: "",
      metadata: () => {},
      ask: async () => {},
      messageID: "parent-message",
      agent: "sisyphus",
      abort: new AbortController().signal,
    }

    await tool.execute(
      { file_path: "/test/file.png", goal: "analyze image" },
      toolContext
    )

    expect(promptBody.model).toEqual({
      providerID: "google",
      modelID: "gemini-3-flash",
    })
  })
})
