import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

export function createBashSafetyHook(_ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: any }
    ) => {
      const toolName = input.tool.toLowerCase()
      if (toolName !== "bash" && toolName !== "interactive_bash") {
        return
      }

      // 1. Enforce Timeout (as per safety audit)
      // Default: 60s, Max: 600s
      if (output.args) {
        const currentTimeout = output.args.timeout ?? output.args.timeout_ms
        const maxTimeout = 600_000
        const defaultTimeout = 60_000

        if (!currentTimeout || currentTimeout > maxTimeout) {
            log(`[Bash Safety] Capping timeout for ${input.tool} to ${maxTimeout}ms`)
            if (output.args.timeout !== undefined) output.args.timeout = maxTimeout
            if (output.args.timeout_ms !== undefined) output.args.timeout_ms = maxTimeout
            if (!output.args.timeout && !output.args.timeout_ms) {
               // If no timeout was provided, set the default
               output.args.timeout = defaultTimeout
            }
        }
      }

      // 2. Log blocking risks
      if (output.args?.command?.includes("build") || output.args?.command?.includes("test")) {
          log(`[Bash Safety] Long-running command detected: ${output.args.command}. This may block the agent.`)
      }
    }
  }
}
