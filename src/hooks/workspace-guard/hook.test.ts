import { describe, expect, it, spyOn, beforeEach } from "bun:test"
import { createWorkspaceGuardHook } from "./hook"
import type { PluginInput } from "@opencode-ai/plugin"
import * as child_process from "child_process"

describe("WorkspaceGuardHook", () => {
  let ctx: PluginInput
  const mockRepoRoot = "/home/heidi/work/oh-my-opencode-heidi"

  beforeEach(() => {
    ctx = {
      directory: mockRepoRoot,
      client: {} as any,
    } as any

    // Mock git commands with specific return types to satisfy lint/tsc
    spyOn(child_process, "execSync").mockImplementation((cmd: string) => {
      if (cmd.includes("rev-parse --show-toplevel")) return mockRepoRoot as any
      if (cmd.includes("remote get-url origin")) return "https://github.com/heidi-dang/oh-my-opencode.git" as any
      if (cmd.includes("branch --show-current")) return "main" as any
      return "" as any
    })
  })

  it("should fail preflight if target file is missing", async () => {
    const hook = createWorkspaceGuardHook(ctx)
    const chatMessage = hook["chat.message"] as Function

    const input = { 
      message: { 
        parts: [{ type: "text", text: "Please fix the bug in non-existent-file.ts" }] 
      } 
    }

    await expect(chatMessage(input)).rejects.toThrow("[WORKSPACE GUARD] PREFLIGHT FAILED")
  })

  it("should block destructive git actions until confirmed", async () => {
    const hook = createWorkspaceGuardHook(ctx)
    const execBefore = hook["tool.execute.before"] as Function

    const input = { tool: "git" }
    const output = { args: { args: ["commit", "-m", "test"] } }

    await expect(execBefore(input, output)).rejects.toThrow("[WORKSPACE GUARD] EXPLICIT CONFIRMATION REQUIRED")
  })

  it("should allow git actions after confirmation event", async () => {
    const hook = createWorkspaceGuardHook(ctx)
    const execBefore = hook["tool.execute.before"] as Function
    const eventHandler = hook["event"] as Function

    // Trigger confirmation event
    await eventHandler({ event: { type: "workspace.confirmed" } })

    const input = { tool: "git" }
    const output = { args: { args: ["commit", "-m", "test"] } }

    // Should NOT throw now
    await execBefore(input, output)
  })
})
