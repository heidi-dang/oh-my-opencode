import { describe, expect, it } from "bun:test"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"

import { findNearestMessageWithFieldsAsync, findFirstMessageWithAgentAsync } from "./injector"

const BASE = join(process.cwd(), "local-ignore", "test-find-nearest")

function ensureClean(dir: string) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

describe("findNearestMessageWithFieldsAsync & findFirstMessageWithAgentAsync", () => {
  it("returns the nearest message with agent+model when present", async () => {
    const d = join(BASE, "ses1")
    ensureClean(d)

    // older message without agent
    writeFileSync(join(d, "0001.json"), JSON.stringify({ id: "m1", sessionID: "ses1", role: "user" }))

    // newer message with agent and model
    writeFileSync(
      join(d, "0002.json"),
      JSON.stringify({
        id: "m2",
        sessionID: "ses1",
        role: "assistant",
        agent: "hephaestus",
        model: { providerID: "openai", modelID: "gpt-5" },
      }),
    )

    const res = await findNearestMessageWithFieldsAsync(d)
    expect(res).not.toBeNull()
    expect(res?.agent).toBe("hephaestus")
    expect(res?.model?.providerID).toBe("openai")
  })

  it("finds first (oldest) message agent", async () => {
    const d = join(BASE, "ses2")
    ensureClean(d)

    writeFileSync(
      join(d, "0001.json"),
      JSON.stringify({ id: "m1", sessionID: "ses2", role: "user", agent: "sisyphus" }),
    )
    writeFileSync(join(d, "0002.json"), JSON.stringify({ id: "m2", sessionID: "ses2", role: "assistant" }))

    const first = await findFirstMessageWithAgentAsync(d)
    expect(first).toBe("sisyphus")
  })
})
