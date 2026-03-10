import { log } from "../../shared/logger"

const SCORE_TABLE_PATTERN = /\|\s*(?:Durability|Scalability|Maintainability|Average)\s*\|\s*\d+/i
const COMPLETE_TASK_TOOLS = ["complete_task", "task_update"]

export function createCritiqueGateHook() {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; input: Record<string, unknown> },
      output: { allow: boolean; message?: string }
    ) => {
      // Only gate complete_task calls (status=completed)
      if (!COMPLETE_TASK_TOOLS.includes(input.tool)) return
      
      // For task_update, only gate completion status
      if (input.tool === "task_update") {
        const status = input.input?.status as string | undefined
        if (status !== "completed") return
      }

      // Check if the most recent assistant message contains a score table
      // We do this by checking a flag set during message transform
      const hasScoreTable = critiqueScoreCache.get(input.sessionID)
      
      if (!hasScoreTable) {
        log("[critique-gate] Blocking complete_task — no self-score table found in assistant message", {
          sessionID: input.sessionID,
          tool: input.tool,
        })
        output.allow = false
        output.message = `[CRITIQUE GATE REJECTION] You attempted to complete the task without providing the mandatory Architectural Self-Score table. You MUST include a Durability/Scalability/Maintainability score table (with scores ≥ 8 average) in your response before calling complete_task. Go back and add it.`
        return
      }
    },
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: unknown }
    ) => {
      // After any tool, scan the output for score tables to update cache
      if (output.output && SCORE_TABLE_PATTERN.test(output.output)) {
        critiqueScoreCache.set(input.sessionID, true)
      }
    },
    "experimental.chat.messages.transform": async (
      input: { sessionID: string },
      output: { messages: any[] }
    ) => {
      // Scan the latest assistant messages for score tables
      for (let i = output.messages.length - 1; i >= 0; i--) {
        const msg = output.messages[i]
        if (msg?.role === "assistant") {
          const content = typeof msg.content === "string" 
            ? msg.content 
            : Array.isArray(msg.content) 
              ? msg.content.map((p: any) => p.text || "").join("\n")
              : ""
          
          if (SCORE_TABLE_PATTERN.test(content)) {
            critiqueScoreCache.set(input.sessionID, true)
          } else {
            critiqueScoreCache.set(input.sessionID, false)
          }
          break
        }
      }
    }
  }
}

const critiqueScoreCache = new Map<string, boolean>()
