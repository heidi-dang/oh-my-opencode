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
    
    if (response === null || response === undefined) {
      throw new Error("SDK returned null or undefined session messages")
    }

    const messages = normalizeSDKResponse(
      response,
      [] as Array<{ info?: { role?: string }; parts?: Array<any> }>,
      { preferResponseOnMissingData: true }
    )

    // Find the last complete_task invocation
    let lastCompleteTaskIndex = -1
    let lastCompleteTaskPart: any = null

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.info?.role === "assistant" || msg.info?.role === "tool") {
        const parts = msg.parts ?? []
        for (const p of parts) {
          if (p.type === "tool" && (p.toolName === "complete_task" || p.name === "complete_task" || p.tool === "complete_task")) {
            lastCompleteTaskIndex = i
            lastCompleteTaskPart = p
            break
          }
        }
      }
      if (lastCompleteTaskIndex !== -1) break
    }

    if (lastCompleteTaskIndex !== -1 && lastCompleteTaskPart) {
       // In OpenCode SDK, the tool result is often within the same part under `state.output`
       let hasErrorResult = false
       let foundResult = false

       if (lastCompleteTaskPart.state && (lastCompleteTaskPart.state.status === "completed" || lastCompleteTaskPart.state.status === "error")) {
         foundResult = true
         const output = typeof lastCompleteTaskPart.state.output === "string" ? lastCompleteTaskPart.state.output : JSON.stringify(lastCompleteTaskPart.state.output || "")
         if (output.includes("[ERROR] TASK COMPLETION REJECTED") || output.includes("[ERROR] STRICT ISSUE RESOLUTION MODE") || output.includes("explicitly failed") || lastCompleteTaskPart.state.status === "error") {
           hasErrorResult = true
         }
       }

       // Also look forward in case the result came in a separate subsequent message
       if (!foundResult) {
         for (let i = lastCompleteTaskIndex + 1; i < messages.length; i++) {
           const msg = messages[i]
           if (msg.info?.role === "user" || msg.info?.role === "tool") {
             const parts = msg.parts ?? []
             for (const p of parts) {
               if (p.type === "tool_result" || p.type === "tool") {
                  foundResult = true
                  const content = typeof p.content === "string" ? p.content : (typeof p.state?.output === "string" ? p.state.output : JSON.stringify(p.content || p.state?.output || ""))
                  if (content.includes("[ERROR] TASK COMPLETION REJECTED") || content.includes("[ERROR] STRICT ISSUE RESOLUTION MODE") || content.includes("explicitly failed") || p.state?.status === "error") {
                    hasErrorResult = true
                  }
               } else if (p.type === "text" && typeof p.text === "string" && p.text.includes("[tool result]")) {
                  if (p.text.includes("[ERROR] TASK COMPLETION REJECTED") || p.text.includes("[ERROR] STRICT ISSUE RESOLUTION MODE") || p.text.includes("explicitly failed")) {
                    foundResult = true
                    hasErrorResult = true
                  }
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
    // FAIL-CLOSED: Any error during verification means we cannot confirm completion.
    // Default to false (not complete) - this ensures rejected completions stay rejected
    // even when we cannot verify the state.
    log("[verifyTaskCompletionState] Error verifying task completion state, fail-closed:", error)
    return false
  }
}
