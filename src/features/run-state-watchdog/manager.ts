import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import { SafeToastWrapper } from "../../shared/safe-toast-wrapper"

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

interface StallEvent {
  sessionID: string
  timestamp: number
  durationMs: number
  stage: "warn" | "nudge" | "abort"
  modelID?: string
}

export class RunStateWatchdogManager {
  private client: OpencodeClient
  private activeSessions = new Map<string, SessionRunContext>()
  private pollingIntervalMs: number
  private stallThresholdMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private stallLog: StallEvent[] = []
  private nudgedSessions = new Set<string>()

  constructor(client: OpencodeClient, opts?: { pollingIntervalMs?: number; stallThresholdMs?: number }) {
    this.client = client
    this.pollingIntervalMs = opts?.pollingIntervalMs ?? 5000
    this.stallThresholdMs = opts?.stallThresholdMs ?? 90000
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

    // Clear nudge marker when session becomes active again
    if (state === "running") {
      this.nudgedSessions.delete(sessionID)
    }
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
    // Activity resets nudge state
    this.nudgedSessions.delete(sessionID)
  }

  public updateTodos(sessionID: string, count: number) {
    const ctx = this.getOrCreate(sessionID)
    ctx.openTodos = count
  }

  public getContext(sessionID: string): SessionRunContext | undefined {
    return this.activeSessions.get(sessionID)
  }

  public getStallLog(): ReadonlyArray<StallEvent> {
    return this.stallLog
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

  private logStallEvent(sessionID: string, durationMs: number, stage: StallEvent["stage"], modelID?: string) {
    const event: StallEvent = { sessionID, timestamp: Date.now(), durationMs, stage, modelID }
    this.stallLog.push(event)

    // Cap log size at 100 entries
    if (this.stallLog.length > 100) {
      this.stallLog.splice(0, this.stallLog.length - 100)
    }

    log(`[RunStateWatchdog] STALL EVENT`, event)
  }

  private getModelID(sessionID: string): string | undefined {
    try {
      const sessionState = (this.client as any).session?.state?.({ path: { id: sessionID } })
      return sessionState?.modelID
    } catch {
      return undefined
    }
  }

  private async checkStalledRuns() {
    try {
      const now = Date.now()
      for (const [sessionID, ctx] of this.activeSessions.entries()) {
        if (ctx.currentState !== "running" && ctx.currentState !== "waiting") continue

        const timeSinceLastActivity = now - ctx.lastActivityAt
        const timeSinceText = now - ctx.lastTextFragmentAt
        const timeSinceTool = now - ctx.lastToolCallAt
        const stallRatio = timeSinceLastActivity / this.stallThresholdMs

        // Stage 1: Warning toast at 50% threshold (~45s)
        if (stallRatio >= 0.5 && stallRatio < 0.6) {
          const modelID = this.getModelID(sessionID)
          this.logStallEvent(sessionID, timeSinceLastActivity, "warn", modelID)
          this.notifyStall(sessionID, "warn").catch(() => {})
        }

        // Stage 2: Nudge at 78% threshold (~70s) — inject a corrective message
        if (stallRatio >= 0.78 && stallRatio < 0.85 && !this.nudgedSessions.has(sessionID)) {
          const modelID = this.getModelID(sessionID)
          this.nudgedSessions.add(sessionID)
          this.logStallEvent(sessionID, timeSinceLastActivity, "nudge", modelID)
          this.notifyStall(sessionID, "nudge").catch(() => {})
        }

        // Stage 3: Abort at 100% threshold (90s)
        if (timeSinceText > this.stallThresholdMs && timeSinceTool > this.stallThresholdMs) {
          const modelID = this.getModelID(sessionID)
          this.logStallEvent(sessionID, timeSinceLastActivity, "abort", modelID)

          ctx.currentState = "terminal"
          this.nudgedSessions.delete(sessionID)

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
            // Swallow toast errors
          }
        }
      }
    } catch (err) {
      log("[RunStateWatchdog] Unexpected error in checkStalledRuns — swallowed to prevent process crash", { error: String(err) })
    }
  }

  private async notifyStall(sessionID: string, stage: "warn" | "nudge") {
    try {
      const tuiClient = this.client as unknown as Record<string, unknown>
      const tui = tuiClient?.tui as Record<string, unknown> | undefined

      let stallTitle: string
      let stallMessage: string
      let variant: string

      const modelID = this.getModelID(sessionID)?.toLowerCase() || ""
      const isReasoningModel = modelID.includes("o1") || modelID.includes("reasoning") || modelID.includes("thinking")

      if (stage === "warn") {
        stallTitle = isReasoningModel ? "Deep reasoning in progress..." : "Still thinking..."
        stallMessage = isReasoningModel
          ? "This model uses extended reasoning and may take several minutes. Please stand by."
          : "The model is taking longer than expected. I'm keeping the session alive."
        variant = "warning"
      } else {
        stallTitle = "Possible stall detected"
        stallMessage = "The session has been inactive for 70+ seconds. If the model doesn't respond soon, it will be automatically terminated."
        variant = "error"
      }

      // Create a minimal ctx-like object for SafeToastWrapper
      const minimalCtx = {
        client: this.client,
        directory: "",
        project: { id: "" },
        worktree: { id: "" },
        serverUrl: "",
        $: async () => ({ data: {} })
      } as unknown as PluginInput

      SafeToastWrapper.showToast(
        minimalCtx,
        {
          title: stallTitle,
          message: stallMessage,
          variant: variant as any,
          duration: stage === "warn" ? 5000 : 8000
        },
        `run-state-watchdog:${sessionID}:${stage}`
      )
    } catch {
      // Swallow toast errors
    }
  }
}
