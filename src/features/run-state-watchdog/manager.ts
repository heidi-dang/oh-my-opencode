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
    this.stallThresholdMs = opts?.stallThresholdMs ?? 15000 // 15s without text or tool activity
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
    const now = Date.now()
    for (const [sessionID, ctx] of this.activeSessions.entries()) {
      if (ctx.currentState !== "running" && ctx.currentState !== "waiting") continue

      const timeSinceLastActivity = now - ctx.lastActivityAt
      const timeSinceText = now - ctx.lastTextFragmentAt
      const timeSinceTool = now - ctx.lastToolCallAt

      // If we are ostensibly running, but there's been no text generation and no tool calls for the threshold...
      if (timeSinceText > this.stallThresholdMs && timeSinceTool > this.stallThresholdMs) {
        log(`[RunStateWatchdog] Detected stalled run for session ${sessionID}.`, {
          timeSinceText,
          timeSinceTool,
          openTodos: ctx.openTodos
        })
        
        // Render a toast to show it's still ticking
        const tuiClient = this.client as any
        if (tuiClient.tui?.showToast) {
          tuiClient.tui.showToast({
            body: {
              title: "Task Status",
              message: ctx.currentState === "waiting" ? "Waiting for response..." : "Still working / verifying...",
              variant: "info",
              duration: 3000
            }
          }).catch(() => {})
        }
        
        // Touch the activity so we don't spam toasts
        ctx.lastActivityAt = now
      }
    }
  }
}
