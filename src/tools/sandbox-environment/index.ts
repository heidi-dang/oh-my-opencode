import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { sandboxManager } from "../../features/sandbox/sandbox-manager"
import { getMainSessionID } from "../../features/claude-code-session-state"

export function createSandboxEnvironmentTool(): ToolDefinition {
  return tool({
    description: "Manage the sandbox environment for the current session. Use this to enable isolated execution for commands and file operations.",
    args: {
      action: tool.schema.enum(["enable", "disable", "status"]).describe("The action to perform: 'enable' or 'disable' sandboxing, or 'status' to check if it's active."),
    },
    execute: async (args, context: any) => {
      const sessionID = context?.sessionID || (context?.event?.properties as any)?.sessionID || getMainSessionID()
      if (!sessionID) return "Error: No active session ID found."

      try {
        if (args.action === "enable") {
          await sandboxManager.enableSandboxForSession(sessionID)
          return "Sandbox environment ENABLED for this session. Commands (bash, git) and file writes will now be isolated in a remote container."
        } else if (args.action === "disable") {
          await sandboxManager.disableSandboxForSession(sessionID)
          return "Sandbox environment DISABLED for this session. Subsequent operations will run locally on the host machine."
        } else {
          const enabled = sandboxManager.isSandboxEnabled(sessionID)
          return `Sandbox environment status: ${enabled ? "ENABLED" : "DISABLED"}`
        }
      } catch (err: any) {
        return `Error managing sandbox: ${err.message}`
      }
    },
  })
}
