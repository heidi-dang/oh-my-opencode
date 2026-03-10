import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"

type OpencodeClient = PluginInput["client"]

export type RunState = "idle" | "running" | "waiting" | "terminal"

export interface SessionRunContext {
  sessionID: string
  currentState: RunState
  lastActivityAt: number
  lastTextFragmentAt: number
  lastToolCallAt: number
  openTodos: number
}

export class RunStateWatchdogManager {
  private client: OpencodeClient
  private activeSessions = new Map<string, SessionRunContext>()
  private pollingIntervalMs: number
  private stallThresholdMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(client: OpencodeClient, opts?: { pollingIntervalMs?: number; stallThresholdMs?: number }) {
    this.client = client
    this.pollingIntervalMs = opts?.pollingIntervalMs ?? 5000
    this.stallThresholdMs = opts?.stallThresholdMs ?? 90000 // 90s without text or tool activity
  }

  public start() {
    if (this.timer) return
    this.timer = setInterval(() => this.checkStalledRuns(), this.pollingIntervalMs)
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  public updateState(sessionID: string, state: RunState) {
    const ctx = this.getOrCreate(sessionID)
    ctx.currentState = state
    ctx.lastActivityAt = Date.now()
  }

  public recordActivity(sessionID: string, type: "text" | "tool" | "general") {
    const ctx = this.getOrCreate(sessionID)
    const now = Date.now()
    ctx.lastActivityAt = now
    if (type === "text") {
      ctx.lastTextFragmentAt = now
    } else if (type === "tool") {
      ctx.lastToolCallAt = now
    }
  }

  public updateTodos(sessionID: string, count: number) {
    const ctx = this.getOrCreate(sessionID)
    ctx.openTodos = count
  }

  public getContext(sessionID: string): SessionRunContext | undefined {
    return this.activeSessions.get(sessionID)
  }

  private getOrCreate(sessionID: string): SessionRunContext {
    let ctx = this.activeSessions.get(sessionID)
    if (!ctx) {
      ctx = {
        sessionID,
        currentState: "idle",
        lastActivityAt: Date.now(),
        lastTextFragmentAt: Date.now(),
        lastToolCallAt: Date.now(),
        openTodos: 0,
      }
      this.activeSessions.set(sessionID, ctx)
    }
    return ctx
  }

  private async checkStalledRuns() {
    try {
      const now = Date.now()
      for (const [sessionID, ctx] of this.activeSessions.entries()) {
        if (ctx.currentState !== "running" && ctx.currentState !== "waiting") continue

        const timeSinceLastActivity = now - ctx.lastActivityAt
        const timeSinceText = now - ctx.lastTextFragmentAt
        const timeSinceTool = now - ctx.lastToolCallAt

        // Half-throttle: If stalled for > 50% of threshold, notify user we are still thinking
        if (timeSinceLastActivity > this.stallThresholdMs * 0.5 && timeSinceLastActivity < this.stallThresholdMs * 0.6) {
          log(`[RunStateWatchdog] Session ${sessionID} stalled for >45s. Sending status update.`)
          this.notifyStall(sessionID).catch(() => {})
        }

        // If no text generation and no tool calls for the threshold, terminate
        if (timeSinceText > this.stallThresholdMs && timeSinceTool > this.stallThresholdMs) {
          log(`[RunStateWatchdog] Detected stalled run for session ${sessionID}.`, {
            timeSinceText,
            timeSinceTool,
            openTodos: ctx.openTodos
          })

          // Mark as terminal FIRST to prevent repeated abort attempts
          ctx.currentState = "terminal"

          // Attempt abort — guarded against missing client methods
          try {
            const session = this.client?.session
            if (session && typeof session.abort === "function") {
              log(`[RunStateWatchdog] TERMINATING stalled session ${sessionID}.`)
              session.abort({
                path: { id: sessionID },
              }).catch((err: unknown) => {
                log(`[RunStateWatchdog] Failed to abort stalled session ${sessionID}`, { error: String(err) })
              })
            } else {
              log(`[RunStateWatchdog] Cannot abort session ${sessionID}: client.session.abort not available`)
            }
          } catch (abortErr) {
            log(`[RunStateWatchdog] Error during abort for session ${sessionID}`, { error: String(abortErr) })
          }

          // Toast notification — guarded
          try {
            const tuiClient = this.client as unknown as Record<string, unknown>
            const tui = tuiClient?.tui as Record<string, unknown> | undefined
            if (tui && typeof tui.showToast === "function") {
              tui.showToast({
                body: {
                  title: "Task Aborted",
                  message: "Session terminated due to auto-stall detection (90s inactivity).",
                  variant: "error",
                  duration: 5000
                }
              }).catch(() => {})
            }
          } catch {
            // Swallow toast errors — never let UI calls crash the process
          }
        }
      }
    } catch (err) {
      log("[RunStateWatchdog] Unexpected error in checkStalledRuns — swallowed to prevent process crash", { error: String(err) })
    }
  }

  private async notifyStall(sessionID: string) {
    try {
      const tuiClient = this.client as unknown as Record<string, unknown>
      const tui = tuiClient?.tui as Record<string, unknown> | undefined
      
      // Attempt to get the active model for this session to provide contextual feedback
      let stallMessage = "The model is taking longer than expected. I'm keeping the session alive."
      let stallTitle = "Still thinking..."
      
      try {
        const sessionState = (this.client as any).session?.state?.({ path: { id: sessionID } });
        const modelID = sessionState?.modelID?.toLowerCase() || "";
        if (modelID.includes("o1") || modelID.includes("reasoning") || modelID.includes("thinking")) {
          stallTitle = "Deep reasoning in progress..."
          stallMessage = "This model uses extended reasoning and may take several minutes. Please stand by."
        }
      } catch {
        // Fallback to default message if state lookup fails
      }

      if (tui && typeof tui.showToast === "function") {
        await tui.showToast({
          body: {
            title: stallTitle,
            message: stallMessage,
            variant: "warning",
            duration: 5000
          }
        }).catch(() => {})
      }
    } catch {
      // Swallow toast errors
    }
  }
}
