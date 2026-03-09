import type { Message, Part } from "@opencode-ai/sdk"
import { log } from "../../shared/logger"

interface MessageWithParts {
  info: Message
  parts: Part[]
}

type MessagesTransformHook = {
  "experimental.chat.messages.transform"?: (
    input: Record<string, never>,
    output: { messages: MessageWithParts[] }
  ) => Promise<void>
}

/**
 * Anthropic Prompt Caching Hook
 * 
 * Injects `cache_control: { type: "ephemeral" }` into message parts
 * for Anthropic models to reduce latency and cost in long sessions.
 */
export function createAnthropicPromptCachingHook(): MessagesTransformHook {
  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const { messages } = output

      if (!messages || messages.length < 3) {
        return
      }

      // 1. Detect model from the last user message
      const lastUserMessage = messages.findLast(m => m.info.role === "user")
      const modelID = (lastUserMessage?.info as any)?.modelID || ""
      
      // Prompt caching is only supported on Claude models
      if (!modelID.toLowerCase().includes("claude-")) {
        return
      }

      log(`[anthropic-prompt-caching] Applying cache breakpoints to session (Length: ${messages.length})`)

      try {
        // We use 3 breakpoints to balance persistence and flexibility (max is 4)
        
        // Breakpoint 1: First message (System Prompt + Initial Tools)
        const firstMsg = messages[0]
        if (firstMsg.parts && firstMsg.parts.length > 0) {
          const lastPart = firstMsg.parts[firstMsg.parts.length - 1] as any
          lastPart.cache_control = { type: "ephemeral" }
        }

        // Breakpoint 2: Middle of the conversation
        const midIndex = Math.floor(messages.length / 2)
        if (midIndex > 0 && midIndex < messages.length - 1) {
          const midMsg = messages[midIndex]
          if (midMsg.parts && midMsg.parts.length > 0) {
            const lastPart = midMsg.parts[midMsg.parts.length - 1] as any
            lastPart.cache_control = { type: "ephemeral" }
          }
        }

        // Breakpoint 3: End of the second-to-last user message
        // This caches everything leading up to the current turn.
        const penultimateUserMsgIndex = messages.findLastIndex((m, i) => m.info.role === "user" && i < messages.length - 1)
        if (penultimateUserMsgIndex !== -1) {
          const penMsg = messages[penultimateUserMsgIndex]
          if (penMsg.parts && penMsg.parts.length > 0) {
            const lastPart = penMsg.parts[penMsg.parts.length - 1] as any
            lastPart.cache_control = { type: "ephemeral" }
          }
        }

        log("[anthropic-prompt-caching] Successfully injected 3 cache breakpoints")
      } catch (error) {
        log("[anthropic-prompt-caching] Failed to inject cache control", { error: String(error) })
      }
    }
  }
}
