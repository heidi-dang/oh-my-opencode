import { normalizeSDKResponse } from "./normalize-sdk-response"
import { log } from "./logger"

export async function verifyTaskCompletionState(
  client: any,
  sessionID: string
): Promise<boolean> {
  try {
    const response = await client.session.messages({
      path: { id: sessionID },
    })

    const messages = normalizeSDKResponse(
      response,
      [] as Array<{ info?: { role?: string }; parts?: Array<any> }>,
      { preferResponseOnMissingData: true }
    )

    // Find the last complete_task invocation
    let lastCompleteTaskIndex = -1
    let lastCompleteTaskCallId = ""

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.info?.role === "assistant") {
        const parts = msg.parts ?? []
        for (const p of parts) {
          if (p.type === "tool" && p.toolName === "complete_task") {
            lastCompleteTaskIndex = i
            // In API, tool call ID is usually in callID or toolCallId or just id
            lastCompleteTaskCallId = p.callID || p.id || ""
            break
          }
        }
      }
      if (lastCompleteTaskIndex !== -1) break
    }

    if (lastCompleteTaskIndex !== -1) {
      // Look forward to find the result of this tool call
      let hasErrorResult = false
      let foundResult = false

      for (let i = lastCompleteTaskIndex + 1; i < messages.length; i++) {
        const msg = messages[i]
        if (msg.info?.role === "user" || msg.info?.role === "tool") {
          const parts = msg.parts ?? []
          for (const p of parts) {
            // It might be a tool_result part or a text part containing [tool result]
            if (p.type === "tool_result" && (p.callID === lastCompleteTaskCallId || p.toolCallId === lastCompleteTaskCallId)) {
               foundResult = true
               const content = typeof p.content === "string" ? p.content : JSON.stringify(p.content || "")
               if (content.includes("[ERROR] TASK COMPLETION REJECTED") || content.includes("[ERROR] STRICT ISSUE RESOLUTION MODE")) {
                 hasErrorResult = true
               }
            } else if (p.type === "text" && typeof p.text === "string" && p.text.includes("[tool result]")) {
               // Sometimes tool results come back in text parts
               if (p.text.includes("[ERROR] TASK COMPLETION REJECTED") || p.text.includes("[ERROR] STRICT ISSUE RESOLUTION MODE") || p.text.includes("[Tool Contract Enforcer] Tool execution explicitly failed in complete_task")) {
                 foundResult = true
                 hasErrorResult = true
               }
            }
          }
        }
      }

      if (foundResult && hasErrorResult) {
        log("[verifyTaskCompletionState] Rejected completion because the last complete_task call failed:", sessionID)
        return false
      }
    }

    return true
  } catch (error) {
    log("[verifyTaskCompletionState] Error verifying task completion state, defaulting to true:", error)
    return true
  }
}
