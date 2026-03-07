import { mock } from "bun:test"
import * as fs from "node:fs"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import type { LoadedSkill } from "../../features/opencode-skill-loader/types"
import type { CommandInfo } from "../slashcommand/types"

const originalReadFileSync = fs.readFileSync.bind(fs)

mock.module("node:fs", () => ({
  ...fs,
  readFileSync: (path: string, encoding?: string) => {
    if (typeof path === "string" && path.includes("/skills/")) {
      return `---
description: Test skill description
---
Test skill body content`
    }
    return originalReadFileSync(path, encoding as BufferEncoding)
  },
}))

export function createMockSkill(name: string, options: { agent?: string } = {}): LoadedSkill {
  return {
    name,
    path: `/test/skills/${name}/SKILL.md`,
    resolvedPath: `/test/skills/${name}`,
    definition: {
      name,
      description: `Test skill ${name}`,
      template: "Test template",
      agent: options.agent,
    },
    scope: "opencode-project",
  }
}

export function createMockSkillWithMcp(name: string, mcpServers: Record<string, unknown>): LoadedSkill {
  return {
    name,
    path: `/test/skills/${name}/SKILL.md`,
    resolvedPath: `/test/skills/${name}`,
    definition: {
      name,
      description: `Test skill ${name}`,
      template: "Test template",
    },
    scope: "opencode-project",
    mcpConfig: mcpServers as LoadedSkill["mcpConfig"],
  }
}

export function createMockSkillWithScope(name: string, scope: string): LoadedSkill {
  return {
    name,
    path: `/test/skills/${name}/SKILL.md`,
    resolvedPath: `/test/skills/${name}`,
    definition: {
      name,
      description: `Test skill ${name}`,
      template: "Test template",
    },
    scope: scope as LoadedSkill["scope"],
  }
}

export function createMockCommand(name: string, scope: string): CommandInfo {
  return {
    name,
    path: `/test/commands/${name}.md`,
    metadata: {
      name,
      description: `Test command ${name}`,
    },
    scope: scope as CommandInfo["scope"],
  }
}

export const mockContext: ToolContext = {
  sessionID: "test-session",
  messageID: "msg-1",
  agent: "test-agent",
  directory: "/test",
  worktree: "/test",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
}
