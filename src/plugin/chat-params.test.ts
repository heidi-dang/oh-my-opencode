import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { createChatParamsHandler } from "./chat-params"
import * as connectedProvidersCache from "../shared/connected-providers-cache"

describe("createChatParamsHandler", () => {
  let providerModelsSpy: any

  beforeEach(() => {
    providerModelsSpy = spyOn(connectedProvidersCache, "readProviderModelsCache").mockReturnValue({
      connected: ["opencode"],
      models: {
        "opencode": ["claude-sonnet-4-6"]
      },
      updatedAt: new Date().toISOString()
    })
  })

  afterEach(() => {
    providerModelsSpy?.mockRestore()
  })

  test("normalizes object-style agent payload and runs chat.params hooks", async () => {
    //#given
    let called = false
    const handler = createChatParamsHandler({
      anthropicEffort: {
        "chat.params": async (input) => {
          called = input.agent.name === "sisyphus"
        },
      },
    })

    const input = {
      sessionID: "ses_chat_params",
      agent: { name: "sisyphus" },
      model: { providerID: "opencode", modelID: "claude-sonnet-4-6" },
      provider: { id: "opencode" },
      message: {},
    }

    const output = {
      temperature: 0.1,
      topP: 1,
      topK: 1,
      options: {},
    }

    //#when
    await handler(input, output)

    //#then
    expect(called).toBe(true)
  })
})
