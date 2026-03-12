import { log } from "../../shared/logger"

const SCORE_TABLE_PATTERN = /\|\s*(?:Durability|Scalability|Maintainability|Average)\s*\|\s*\d+/i
const COMPLETE_TASK_TOOLS = ["complete_task", "task_update"]

/**
 * Optimized Critique Gate Hook
 * 
 * Performance improvements:
 * 1. Pre-compiled regex patterns for faster matching
 * 2. Optimized content extraction with early exits
 * 3. Reduced string operations
 * 4. Better cache management with TTL
 * 5. Set-based tool name checking (O(1) lookup)
 */
export function createOptimizedCritiqueGateHook() {
  // Performance optimizations
  const critiqueScoreCache = new Map<string, { hasScore: boolean; timestamp: number }>()
  const cacheTTL = 300000 // 5 minutes
  const COMPLETE_TASK_TOOLS_SET = new Set(COMPLETE_TASK_TOOLS)
  
  // Optimized content extraction
  const extractContent = (msg: any): string => {
    if (!msg) return ""
    
    const content = msg.content
    if (typeof content === "string") {
      return content
    }
    
    if (Array.isArray(content)) {
      let result = ""
      for (let i = 0; i < content.length; i++) {
        const part = content[i]
        if (part?.text) {
          if (result) result += "\n"
          result += part.text
        }
      }
      return result
    }
    
    return ""
  }
  
  // Cache management
  const getCachedScore = (sessionID: string): boolean | null => {
    const cached = critiqueScoreCache.get(sessionID)
    if (!cached) return null
    
    const now = Date.now()
    if (now - cached.timestamp > cacheTTL) {
      critiqueScoreCache.delete(sessionID)
      return null
    }
    
    return cached.hasScore
  }
  
  const setCachedScore = (sessionID: string, hasScore: boolean): void => {
    critiqueScoreCache.set(sessionID, {
      hasScore,
      timestamp: Date.now()
    })
  }
  
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; input: Record<string, unknown> },
      output: { allow: boolean; message?: string }
    ) => {
      // Fast check using Set for O(1) lookup
      if (!COMPLETE_TASK_TOOLS_SET.has(input.tool)) return
      
      // For task_update, only gate completion status
      if (input.tool === "task_update") {
        const status = input.input?.status as string | undefined
        if (status !== "completed") return
      }

      // Check cache first
      const hasScoreTable = getCachedScore(input.sessionID)
      
      if (hasScoreTable === null || !hasScoreTable) {
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
      // Quick check for score pattern in tool output
      const toolOutput = output.output
      if (toolOutput && SCORE_TABLE_PATTERN.test(toolOutput)) {
        setCachedScore(input.sessionID, true)
      }
    },
    
    "experimental.chat.messages.transform": async (
      input: { sessionID: string },
      output: { messages: any[] }
    ) => {
      const messages = output.messages
      if (!messages || messages.length === 0) return
      
      // Scan from the end for the latest assistant message (more efficient)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg?.role === "assistant") {
          const content = extractContent(msg)
          
          // Quick pattern check
          const hasScore = SCORE_TABLE_PATTERN.test(content)
          setCachedScore(input.sessionID, hasScore)
          break
        }
      }
    }
  }
}
