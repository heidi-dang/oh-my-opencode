import { describe, expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { createLookAt } from "./tools"

describe("createLookAt with image_data", () => {
  // given base64 image data is provided
  // when LookAt tool executed
  // then should send data URL to sync prompt
  test("sends data URL when image_data provided", async () => {
    let promptBody: any

    const mockClient = {
      app: {
        agents: async () => ({ data: [] }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_image_data_test" } }),
        prompt: async (input: any) => {
          promptBody = input.body
          return { data: {} }
        },
        messages: async () => ({
          data: [
            { info: { role: "assistant", time: { created: 1 } }, parts: [{ type: "text", text: "analyzed" }] },
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

    await tool.execute(
      { image_data: "data:image/png;base64,iVBORw0KGgo=", goal: "describe this image" },
      toolContext
    )

    const filePart = promptBody.parts.find((p: any) => p.type === "file")
    expect(filePart).toBeDefined()
    expect(filePart.url).toContain("data:image/png;base64")
    expect(filePart.mime).toBe("image/png")
    expect(filePart.filename).toContain("clipboard-image")
  })

  // given raw base64 without data URI prefix
  // when LookAt tool executed
  // then should detect mime type and create proper data URL
  test("handles raw base64 without data URI prefix", async () => {
    let promptBody: any

    const mockClient = {
      app: {
        agents: async () => ({ data: [] }),
      },
      session: {
        get: async () => ({ data: { directory: "/project" } }),
        create: async () => ({ data: { id: "ses_raw_base64_test" } }),
        prompt: async (input: any) => {
          promptBody = input.body
          return { data: {} }
        },
        messages: async () => ({
          data: [
            { info: { role: "assistant", time: { created: 1 } }, parts: [{ type: "text", text: "analyzed" }] },
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

    await tool.execute(
      { image_data: "iVBORw0KGgo=", goal: "analyze" },
      toolContext
    )

    const filePart = promptBody.parts.find((p: any) => p.type === "file")
    expect(filePart).toBeDefined()
    expect(filePart.url).toContain("data:")
    expect(filePart.url).toContain("base64")
  })
})
