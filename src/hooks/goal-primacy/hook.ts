import type { ChatMessageInput, ChatMessageHandlerOutput } from "../../plugin/chat-message"
import { ContextCollector } from "../../features/context-injector/collector"
import { log } from "../../shared"
import { createSystemDirective } from "../../shared/system-directive"

interface FirstMessageVariantGate {
  shouldOverride: (sessionID: string) => boolean
}

export function createGoalPrimacyHook(args: {
  collector: ContextCollector
  firstMessageVariantGate: FirstMessageVariantGate
}) {
  const { collector, firstMessageVariantGate } = args

  return {
    "chat.message": async (input: ChatMessageInput, output: ChatMessageHandlerOutput) => {
      // Only capture if it's the first message of the session
      if (firstMessageVariantGate.shouldOverride(input.sessionID)) {
        const textParts = output.parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text)

        if (textParts.length > 0) {
          const originalGoal = textParts.join("\n\n")
          const persistentContent = `
[ORIGINAL USER GOAL - PERSISTENT INTENTION]
${originalGoal}
---
Note: This goal is persistent. Do NOT drift from this objective. Verify every turn if you are still moving towards this goal.
`.trim()

          collector.register(input.sessionID, {
            id: "original-goal",
            source: "custom",
            content: persistentContent,
            priority: "critical",
            persistent: true,
            metadata: { type: "goal-primacy" }
          })

          log("[goal-primacy] Registered persistent goal for session", { sessionID: input.sessionID })
        }
      }
    },
    "experimental.chat.messages.transform": async (input: { sessionID: string }, output: { messages: any[] }) => {
      const goal = collector.get(input.sessionID, "original-goal")
      if (goal) {
        const goalDirective = createSystemDirective(`PERSISTENT GOAL - ${goal.content}`)
        // Inject at the end of the last message if it's from the system/user, 
        // or add as a new system message to ensure the agent sees it right before thinking.
        output.messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: `\n\n${goalDirective}\n\nREMINDER: You MUST prioritize the above goal over any intermediate tool outputs or sub-tasks.`
            }
          ]
        })
      }
    }
  }
}
