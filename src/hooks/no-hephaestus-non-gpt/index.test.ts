/// <reference types="bun-types" />

import { describe, expect, spyOn, test } from "bun:test"
import { getAgentDisplayName } from "../../shared/agent-display-names"
import { createNoHephaestusNonGptHook } from "./index"

const HEPHAESTUS_DISPLAY = getAgentDisplayName("hephaestus")

function createOutput() {
  return {
    message: {} as { agent?: string;[key: string]: unknown },
    parts: [],
  }
}

describe("no-hephaestus-non-gpt hook", () => {
  test("no warning hook should fire for non-GPT Hephaestus when explicitly configured", async () => {
    // given - hephaestus with explicitly configured non-GPT model (e.g. grok)
    const showToast = spyOn({ fn: async (_input: unknown) => ({}) }, "fn")
    const hook = createNoHephaestusNonGptHook({
      client: { tui: { showToast } },
    } as any)

    const output = createOutput()

    // when - chat.message is called
    await hook["chat.message"]?.({
      sessionID: "ses_1",
      agent: HEPHAESTUS_DISPLAY,
      model: { providerID: "github-copilot", modelID: "xai/grok-4-1-fast" },
    }, output)

    // then - NO toast is shown and agent is NOT switched
    expect(showToast).toHaveBeenCalledTimes(0)
    expect(output.message.agent).toBeUndefined()
  })

  test("does not show toast when hephaestus uses gpt model", async () => {
    // given - hephaestus with gpt model
    const showToast = spyOn({ fn: async (_input: unknown) => ({}) }, "fn")
    const hook = createNoHephaestusNonGptHook({
      client: { tui: { showToast } },
    } as any)

    const output = createOutput()

    // when - chat.message runs
    await hook["chat.message"]?.({
      sessionID: "ses_2",
      agent: HEPHAESTUS_DISPLAY,
      model: { providerID: "openai", modelID: "o3-mini" },
    }, output)

    // then - no toast, agent unchanged
    expect(showToast).toHaveBeenCalledTimes(0)
    expect(output.message.agent).toBeUndefined()
  })
})

