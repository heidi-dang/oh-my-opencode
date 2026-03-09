import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

const EXTERNAL_TOOLS = new Set(["webfetch", "gh_safe", "websearch", "context7_query-docs"])
const FAILURE_THRESHOLD = 2

interface WebFailureState {
  count: number
  history: string[]
}

const failureStates = new Map<string, WebFailureState>()

export const WEB_FAILURE_COLLAPSE_REMINDER = `
[SAFETY ALERT - EXTERNAL FETCH FAILURE]

External tool calls are failing or returning 404s. 
STOP attempting external fetches for this local codebase question.

RECOVERY PLAN:
1. Collapse to LOCAL-ONLY scan path immediately.
2. Use 'rg', 'ast_grep_search', and 'read_file' to find evidence in the current repository.
3. If this is a framework/stack question, look at:
   - package.json / go.mod / requirements.txt
   - Build configs (webpack.config.js, next.config.js, etc.)
   - Import patterns in core files.

PROCEED with local investigation now.
`

export function createWebSafetyHook(_ctx: PluginInput) {
  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: unknown }
    ) => {
      const toolName = input.tool.toLowerCase()
      if (!EXTERNAL_TOOLS.has(toolName)) return
      if (typeof output.output !== "string") return

      const outputLower = output.output.toLowerCase()
      const is404 = outputLower.includes("404") || outputLower.includes("not found")
      const isError = outputLower.includes("failed") || outputLower.includes("error")

      if (is404 || isError) {
        log(`[Web Safety] External tool ${input.tool} failed in session ${input.sessionID}`)
        
        const state = failureStates.get(input.sessionID) || { count: 0, history: [] }
        state.count++
        state.history.push(input.tool)
        failureStates.set(input.sessionID, state)

        if (state.count >= FAILURE_THRESHOLD || is404) {
          log(`[Web Safety] Failure threshold reached for session ${input.sessionID}. Injecting collapse reminder.`)
          output.output += `\n${WEB_FAILURE_COLLAPSE_REMINDER}`
        }
      }
    }
  }
}
