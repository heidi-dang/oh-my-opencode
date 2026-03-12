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

/**
 * Optimized RunStateWatchdogManager
 * 
 * Performance improvements:
 * 1. Batch processing to reduce individual API calls
 * 2. Cached model IDs to avoid repeated API calls
 * 3. Optimized session filtering with early exits
 * 4. Reduced object allocations and garbage collection
 * 5. Debounced notifications to prevent spam
 * 6. More efficient data structures (Map/Set lookups)
 */
export class OptimizedRunStateWatchdogManager {
  private client: OpencodeClient
  private activeSessions = new Map<string, SessionRunContext>()
  private pollingIntervalMs: number
  private stallThresholdMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private stallLog: StallEvent[] = []
  private nudgedSessions = new Set<string>()
  
  // Performance optimizations
  private modelIDCache = new Map<string, string | undefined>()
  private modelIDCacheExpiry = new Map<string, number>()
  private modelIDCacheTTL = 30000 // 30 seconds
  private lastNotificationTime = new Map<string, number>()
  private notificationDebounceMs = 5000 // 5 seconds between notifications per session
  private batchAbortQueue = new Set<string>()

  constructor(client: OpencodeClient, opts?: { pollingIntervalMs?: number; stallThresholdMs?: number }) {
    this.client = client
    this.pollingIntervalMs = opts?.pollingIntervalMs ?? 10000
    this.stallThresholdMs = opts?.stallThresholdMs ?? 600000 // 10 minutes
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
  }

  private getOrCreate(sessionID: string): SessionRunContext {
    let ctx = this.activeSessions.get(sessionID)
    if (!ctx) {
      const now = Date.now()
      ctx = {
        sessionID,
        currentState: "idle",
        lastActivityAt: now,
        lastTextFragmentAt: now,
        lastToolCallAt: now,
        openTodos: 0,
      }
      this.activeSessions.set(sessionID, ctx)
    }
    return ctx
  }

  private logStallEvent(sessionID: string, durationMs: number, stage: StallEvent["stage"], modelID?: string) {
    const event: StallEvent = { sessionID, timestamp: Date.now(), durationMs, stage, modelID }
    this.stallLog.push(event)

    // Cap log size at 100 entries (more efficient than splice)
    if (this.stallLog.length > 100) {
      this.stallLog = this.stallLog.slice(-100)
    }

    log(`[RunStateWatchdog] STALL EVENT`, event)
  }

  private getModelID(sessionID: string): string | undefined {
    // Check cache first
    const cached = this.modelIDCache.get(sessionID)
    const expiry = this.modelIDCacheExpiry.get(sessionID)
    const now = Date.now()
    
    if (cached !== undefined && expiry && now < expiry) {
      return cached
    }

    // Cache miss or expired, fetch from API
    let modelID: string | undefined
    try {
      const clientAny = this.client as any
      const session = clientAny?.session
      if (session && typeof session.state === 'function') {
        const sessionState = session.state.call(session, { path: { id: sessionID } })
        modelID = sessionState?.modelID
      }
    } catch {
      modelID = undefined
    }

    // Cache the result
    this.modelIDCache.set(sessionID, modelID)
    this.modelIDCacheExpiry.set(sessionID, now + this.modelIDCacheTTL)

    return modelID
  }

  private shouldNotify(sessionID: string, stage: "warn" | "nudge"): boolean {
    const lastTime = this.lastNotificationTime.get(sessionID) || 0
    const now = Date.now()
    
    // Different debounce intervals for different stages
    const debounceMs = stage === "warn" ? this.notificationDebounceMs : this.notificationDebounceMs * 2
    
    if (now - lastTime < debounceMs) {
      return false
    }
    
    this.lastNotificationTime.set(sessionID, now)
    return true
  }

  private async checkStalledRuns() {
    try {
      if (!this.client || !(this.client as any)?.session) {
        return
      }

      const now = Date.now()
      const stalledSessions: Array<{
        sessionID: string
        ctx: SessionRunContext
        stallRatio: number
        timeSinceLastActivity: number
        timeSinceText: number
        timeSinceTool: number
      }> = []

      // First pass: identify stalled sessions
      for (const [sessionID, ctx] of this.activeSessions.entries()) {
        // Skip non-running sessions
        if (ctx.currentState !== "running" && ctx.currentState !== "waiting") continue

        const timeSinceLastActivity = now - ctx.lastActivityAt
        const timeSinceText = now - ctx.lastTextFragmentAt
        const timeSinceTool = now - ctx.lastToolCallAt
        const stallRatio = timeSinceLastActivity / this.stallThresholdMs

        // Only process if actually stalled
        if (stallRatio >= 0.5) {
          stalledSessions.push({
            sessionID,
            ctx,
            stallRatio,
            timeSinceLastActivity,
            timeSinceText,
            timeSinceTool
          })
        }
      }

      // Early exit if no stalled sessions
      if (stalledSessions.length === 0) {
        // Clean up old cache entries periodically
        if (Math.random() < 0.1) { // 10% chance each run
          this.cleanupCache()
        }
        return
      }

      // Batch process model IDs
      const modelIDs = new Map<string, string | undefined>()
      for (const { sessionID } of stalledSessions) {
        modelIDs.set(sessionID, this.getModelID(sessionID))
      }

      // Process notifications and aborts
      for (const { sessionID, ctx, stallRatio, timeSinceLastActivity, timeSinceText, timeSinceTool } of stalledSessions) {
        const modelID = modelIDs.get(sessionID)

        // Stage 1: Warning at 50% threshold
        if (stallRatio >= 0.5 && stallRatio < 0.6 && this.shouldNotify(sessionID, "warn")) {
          this.logStallEvent(sessionID, timeSinceLastActivity, "warn", modelID)
          this.notifyStall(sessionID, "warn").catch(() => {})
        }

        // Stage 2: Nudge at 78% threshold
        if (stallRatio >= 0.78 && stallRatio < 0.85 && !this.nudgedSessions.has(sessionID) && this.shouldNotify(sessionID, "nudge")) {
          this.nudgedSessions.add(sessionID)
          this.logStallEvent(sessionID, timeSinceLastActivity, "nudge", modelID)
          this.notifyStall(sessionID, "nudge").catch(() => {})
        }

        // Stage 3: Abort at 100% threshold
        if (timeSinceText > this.stallThresholdMs && timeSinceTool > this.stallThresholdMs) {
          this.logStallEvent(sessionID, timeSinceLastActivity, "abort", modelID)
          this.batchAbortQueue.add(sessionID)
        }
      }

      // Batch process aborts
      if (this.batchAbortQueue.size > 0) {
        await this.processBatchAborts()
      }

    } catch (err) {
      log("[RunStateWatchdog] Unexpected error in checkStalledRuns — swallowed to prevent process crash", { error: String(err) })
    }
  }

  private async processBatchAborts() {
    const clientAny = this.client as any
    const session = clientAny?.session
    
    if (!session || typeof session.abort !== "function") {
      this.batchAbortQueue.clear()
      return
    }

    const abortPromises: Promise<void>[] = []
    
    for (const sessionID of this.batchAbortQueue) {
      const ctx = this.activeSessions.get(sessionID)
      if (!ctx) continue

      ctx.currentState = "terminal"
      this.nudgedSessions.delete(sessionID)

      const reason = `Session terminated due to auto-stall detection (${Math.round((Date.now() - ctx.lastActivityAt) / 1000)}s inactivity)`
      log(`[RunStateWatchdog] TERMINATING stalled session ${sessionID}: ${reason}`)
      
      const abortPromise = session.abort({ path: { id: sessionID } })
        .catch((err: unknown) => {
          log(`[RunStateWatchdog] Failed to abort stalled session ${sessionID}`, { error: String(err) })
        })
      
      abortPromises.push(abortPromise)
    }

    // Wait for all aborts to complete
    await Promise.allSettled(abortPromises)
    
    // Show single toast for all aborts
    if (this.batchAbortQueue.size > 0) {
      try {
        const tuiClient = this.client as unknown as Record<string, unknown>
        const tui = tuiClient?.tui as Record<string, unknown> | undefined
        if (tui && typeof tui.showToast === "function") {
          tui.showToast({
            body: {
              title: "Tasks Aborted",
              message: `${this.batchAbortQueue.size} session(s) terminated due to stall detection.`,
              variant: "error",
              duration: 5000
            }
          }).catch(() => {})
        }
      } catch {
        // Swallow toast errors
      }
    }

    this.batchAbortQueue.clear()
  }

  private cleanupCache() {
    const now = Date.now()
    
    // Clean expired model ID cache entries
    for (const [sessionID, expiry] of this.modelIDCacheExpiry.entries()) {
      if (now > expiry) {
        this.modelIDCache.delete(sessionID)
        this.modelIDCacheExpiry.delete(sessionID)
      }
    }
    
    // Clean old notification times
    for (const [sessionID, lastTime] of this.lastNotificationTime.entries()) {
      if (now - lastTime > 300000) { // 5 minutes
        this.lastNotificationTime.delete(sessionID)
      }
    }
  }

  private async notifyStall(sessionID: string, stage: "warn" | "nudge") {
    try {
      const modelID = this.getModelID(sessionID)
      const isReasoningModel = modelID?.includes("o1") || modelID?.includes("reasoning") || modelID?.includes("thinking")

      let stallTitle: string
      let stallMessage: string
      let variant: string

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

// Export alias for compatibility
export const createOptimizedRunStateWatchdogManager = OptimizedRunStateWatchdogManager
