/**
 * Poll a sync session until completion or timeout.
 * 
 * IMPORTANT: This function returns null ONLY when:
 * 1. isSessionComplete() returns true (verified terminal finish), OR
 * 2. Timeout is reached (timedOut = true)
 * 
 * The fallback path "assistant text detected" was REMOVED because it cannot verify
 * that complete_task was actually called and succeeded. Treating assistant text
 * as completion is a security vulnerability - it allows bypass of the authoritative
 * completion gate.
 * 
 * @returns null if session completed (verified), error string if failed, timeout message if timed out
 */
import type { ToolContextWithMetadata, OpencodeClient } from "./types"
import type { SessionMessage } from "./executor-types"
import { getDefaultSyncPollTimeoutMs, getTimingConfig } from "./timing"
import { log } from "../../shared/logger"
import { normalizeSDKResponse } from "../../shared"

const NON_TERMINAL_FINISH_REASONS = new Set(["tool-calls", "unknown"])

export function isSessionComplete(messages: SessionMessage[]): boolean {
  let lastUser: SessionMessage | undefined
  let lastAssistant: SessionMessage | undefined

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!lastAssistant && msg.info?.role === "assistant") lastAssistant = msg
    if (!lastUser && msg.info?.role === "user") lastUser = msg
    if (lastUser && lastAssistant) break
  }

  if (!lastAssistant?.info?.finish) return false
  if (NON_TERMINAL_FINISH_REASONS.has(lastAssistant.info.finish)) return false
  if (!lastUser?.info?.id || !lastAssistant?.info?.id) return false
  return lastUser.info.id < lastAssistant.info.id
}

export async function pollSyncSession(
  ctx: ToolContextWithMetadata,
  client: OpencodeClient,
  input: {
    sessionID: string
    agentToUse: string
    toastManager: { removeTask: (id: string) => void } | null | undefined
    taskId: string | undefined
    anchorMessageCount?: number
  },
  timeoutMs?: number
): Promise<string | null> {
  const syncTiming = getTimingConfig()
  const maxPollTimeMs = Math.max(timeoutMs ?? getDefaultSyncPollTimeoutMs(), 50)
  const pollStart = Date.now()
  let pollCount = 0
  let timedOut = false

  log("[task] Starting poll loop", { sessionID: input.sessionID, agentToUse: input.agentToUse })

  while (Date.now() - pollStart < maxPollTimeMs) {
    if (ctx.abort?.aborted) {
      log("[task] Aborted by user", { sessionID: input.sessionID })
      if (input.toastManager && input.taskId) input.toastManager.removeTask(input.taskId)
      return `Task aborted.\n\nSession ID: ${input.sessionID}`
    }

    await new Promise(resolve => setTimeout(resolve, syncTiming.POLL_INTERVAL_MS))
    pollCount++

    let statusResult: { data?: Record<string, { type: string }> }
    try {
      statusResult = await client.session.status()
    } catch (error) {
      log("[task] Poll status fetch failed, retrying", { sessionID: input.sessionID, error: String(error) })
      continue
    }
    const allStatuses = normalizeSDKResponse(statusResult, {} as Record<string, { type: string }>)
    const sessionStatus = allStatuses[input.sessionID]

    if (pollCount % 10 === 0) {
      log("[task] Poll status", {
        sessionID: input.sessionID,
        pollCount,
        elapsed: Math.floor((Date.now() - pollStart) / 1000) + "s",
        sessionStatus: sessionStatus?.type ?? "not_in_status",
      })
    }

    if (sessionStatus && sessionStatus.type !== "idle") {
      continue
    }

    let messagesResult: { data?: unknown } | SessionMessage[]
    try {
      messagesResult = await client.session.messages({ path: { id: input.sessionID } })
    } catch (error) {
      log("[task] Poll messages fetch failed, retrying", { sessionID: input.sessionID, error: String(error) })
      continue
    }
    const rawData = (messagesResult as { data?: unknown })?.data ?? messagesResult
    const msgs = Array.isArray(rawData) ? (rawData as SessionMessage[]) : []

    if (input.anchorMessageCount !== undefined && msgs.length <= input.anchorMessageCount) {
      continue
    }

    if (isSessionComplete(msgs)) {
      log("[task] Poll complete - terminal finish detected", { sessionID: input.sessionID, pollCount })
      break
    }
    // 
    // REMOVED FALLBACK: The old fallback path that treated "assistant text appeared"
    // as completion is REMOVED. This was a security vulnerability - assistant text
    // alone does NOT verify that complete_task was called and succeeded.
    //
    // Only isSessionComplete() (verified terminal finish) allows completion.
    // If no terminal finish is detected, the poll will timeout.
    // The caller (sync-task.ts) must handle timeout as non-success.
    //
  }

  if (Date.now() - pollStart >= maxPollTimeMs) {
    timedOut = true
    log("[task] Poll timeout reached", { sessionID: input.sessionID, pollCount })
  }

  return timedOut ? `Poll timeout reached after ${maxPollTimeMs}ms for session ${input.sessionID}` : null
}
