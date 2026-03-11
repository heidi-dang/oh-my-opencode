import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "./logger"

type ClientWithTui = {
  tui?: {
    showToast: (opts: { body: { title: string; message: string; variant: string; duration: number } }) => Promise<unknown>
  }
}

/**
 * SafeToastWrapper - Centralized fail-safe toast emission
 * 
 * This wrapper ensures that toast operations never:
 * - Throw into runtime/session/task flow
 * - Block completion/cancel/cleanup (never awaited)
 * - Crash when UI context is missing
 * - Create spam loops on repeated failures
 * 
 * All feature families must use this wrapper instead of direct toast calls.
 */
export class SafeToastWrapper {
  private static lastLoggedErrors = new Map<string, number>()
  private static readonly ERROR_LOG_THROTTLE_MS = 5000 // Log same error only once per 5 seconds

  static showToast(
    ctx: PluginInput,
    options: {
      title: string
      message: string
      variant: "info" | "success" | "error" | "warning"
      duration?: number
    },
    context?: string
  ): void {
    // Fire-and-forget - never await to avoid blocking
    void this.showToastInternal(ctx, options, context)
  }

  private static async showToastInternal(
    ctx: PluginInput,
    options: {
      title: string
      message: string
      variant: "info" | "success" | "error" | "warning"
      duration?: number
    },
    context?: string
  ): Promise<void> {
    try {
      // Check if TUI context exists
      const tuiClient = ctx.client as ClientWithTui
      if (!tuiClient?.tui?.showToast) {
        // No UI context available - skip silently
        this.logOnce("no-tui-context", `Toast skipped - no TUI context available`, context)
        return
      }

      // Validate payload
      if (!options.title || !options.message) {
        this.logOnce("invalid-payload", `Toast skipped - invalid payload: missing title or message`, context)
        return
      }

      // Show toast with error handling
      await tuiClient.tui.showToast({
        body: {
          title: options.title,
          message: options.message,
          variant: options.variant,
          duration: options.duration || 5000,
        },
      })

    } catch (err) {
      // Any error is logged but doesn't crash the runtime
      this.logOnce("toast-error", `Toast emission failed: ${String(err)}`, context, err)
    }
  }

  private static logOnce(
    errorType: string,
    message: string,
    context?: string,
    actualError?: unknown
  ): void {
    const key = `${errorType}:${context || 'global'}`
    const now = Date.now()
    const lastLogged = this.lastLoggedErrors.get(key) || 0

    // Throttle logging to prevent spam
    if (now - lastLogged > this.ERROR_LOG_THROTTLE_MS) {
      this.lastLoggedErrors.set(key, now)
      
      const logMessage = context 
        ? `[SafeToastWrapper:${context}] ${message}`
        : `[SafeToastWrapper] ${message}`
      
      if (actualError) {
        log(logMessage, { error: actualError })
      } else {
        log(logMessage)
      }
    }
  }

  /**
   * Convenience method for error toasts
   */
  static showError(ctx: PluginInput, title: string, message: string, context?: string): void {
    this.showToast(ctx, { title, message, variant: "error" }, context)
  }

  /**
   * Convenience method for success toasts
   */
  static showSuccess(ctx: PluginInput, title: string, message: string, context?: string): void {
    this.showToast(ctx, { title, message, variant: "success" }, context)
  }

  /**
   * Convenience method for info toasts
   */
  static showInfo(ctx: PluginInput, title: string, message: string, context?: string): void {
    this.showToast(ctx, { title, message, variant: "info" }, context)
  }

  /**
   * Convenience method for warning toasts
   */
  static showWarning(ctx: PluginInput, title: string, message: string, context?: string): void {
    this.showToast(ctx, { title, message, variant: "warning" }, context)
  }
}
