import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { contextCollector } from "../../features/context-injector"
import { withToolContract } from "../../utils/tool-contract-wrapper"

/**
 * Tool to retrieve all pending session-level memories and context.
 */
export function createRecallMemoryTool(): ToolDefinition {
  return tool({
    description: "Retrieve all current session memories and pending context. ALWAYS execute this as your first step before planning any task to ensure you leverage previously gathered information.",
    args: {},
    execute: withToolContract("recall_memory", async (_, context) => {
      const pending = contextCollector.getPending(context.sessionID)
      
      if (!pending.hasContent) {
        const output = "Session memory is currently empty. No pending context or recorded memories found."
        context.metadata({
          title: "Memory Recall",
          success: true,
          verified: true,
          output
        })
        return output
      }

      const formatted = pending.entries.map(e => `[Source: ${e.source}] [ID: ${e.id}] [Priority: ${e.priority}]\n${e.content}`).join("\n\n---\n\n")
      const output = `Recalled ${pending.entries.length} memory entries from current session:\n\n${formatted}`
      
      context.metadata({
        title: "Memory Recall Results",
        success: true,
        verified: true,
        count: pending.entries.length
      })
      
      return output
    })
  })
}
