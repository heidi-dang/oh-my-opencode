import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as shared from "../../shared"

const mockGetClaudeConfigDir = mock(() => "/mock/claude-config")
const mockGetOpenCodeConfigDir = mock(() => "/mock/opencode-config")
const mockDiscoverPluginCommandDefinitions = mock(() => ({}))

mock.module("../../shared", () => ({
  ...shared,
  getClaudeConfigDir: mockGetClaudeConfigDir,
  getOpenCodeConfigDir: mockGetOpenCodeConfigDir,
  discoverPluginCommandDefinitions: mockDiscoverPluginCommandDefinitions,
}))

const { executeSlashCommand } = await import("./executor")

describe("auto-slash command executor plugin dispatch", () => {
  beforeEach(() => {
    mockGetClaudeConfigDir.mockClear()
    mockGetOpenCodeConfigDir.mockClear()
    mockDiscoverPluginCommandDefinitions.mockClear()

    mockGetClaudeConfigDir.mockReturnValue("/mock/claude-config")
    mockGetOpenCodeConfigDir.mockReturnValue("/mock/opencode-config")
  })

  it("resolves marketplace plugin commands when plugin loading is enabled", async () => {
    mockDiscoverPluginCommandDefinitions.mockReturnValue({
      "daplug:run-prompt": {
        name: "run-prompt",
        description: "Run prompt from daplug",
        template: "Execute daplug prompt flow.",
      },
    })

    const result = await executeSlashCommand(
      {
        command: "daplug:run-prompt",
        args: "ship it",
        raw: "/daplug:run-prompt ship it",
      },
      {
        skills: [],
        pluginsEnabled: true,
      },
    )

    expect(result.success).toBe(true)
    expect(result.replacementText).toContain("# /daplug:run-prompt Command")
    expect(result.replacementText).toContain("**Scope**: plugin")
  })

  it("excludes marketplace commands when plugins are disabled via config toggle", async () => {
    mockDiscoverPluginCommandDefinitions.mockReturnValue({})

    const result = await executeSlashCommand(
      {
        command: "daplug:run-prompt",
        args: "",
        raw: "/daplug:run-prompt",
      },
      {
        skills: [],
        pluginsEnabled: false,
      },
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Command "/daplug:run-prompt" not found. Use the skill tool to list available skills and commands.',
    )
  })

  it("returns standard not-found for unknown namespaced commands", async () => {
    const result = await executeSlashCommand(
      {
        command: "daplug:missing",
        args: "",
        raw: "/daplug:missing",
      },
      {
        skills: [],
        pluginsEnabled: true,
      },
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Command "/daplug:missing" not found. Use the skill tool to list available skills and commands.',
    )
    expect(result.error).not.toContain("Marketplace plugin commands")
  })

  it("replaces $ARGUMENTS placeholders in plugin command templates", async () => {
    mockDiscoverPluginCommandDefinitions.mockReturnValue({
      "daplug:templated": {
        name: "templated",
        description: "Templated prompt from daplug",
        template: "Echo $ARGUMENTS and ${user_message}.",
      },
    })

    const result = await executeSlashCommand(
      {
        command: "daplug:templated",
        args: "ship it",
        raw: "/daplug:templated ship it",
      },
      {
        skills: [],
        pluginsEnabled: true,
      },
    )

    expect(result.success).toBe(true)
    expect(result.replacementText).toContain("Echo ship it and ship it.")
    expect(result.replacementText).not.toContain("$ARGUMENTS")
    expect(result.replacementText).not.toContain("${user_message}")
  })
})
