import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "./logger"

type ClientWithTui = {
  tui?: {
    publish: (opts: { body: { type: string; properties: Record<string, any> } }) => Promise<unknown>
  }
}

export class SafeDiagnosticTriggerWrapper {
  static triggerDiagnostic(
    ctx: PluginInput,
    diagnosticClass: string | null,
    message: string | null = null,
  ): void {
    void this.triggerDiagnosticInternal(ctx, diagnosticClass, message)
  }

  private static async triggerDiagnosticInternal(
    ctx: PluginInput,
    diagnosticClass: string | null,
    message: string | null,
  ): Promise<void> {
    try {
      const tuiClient = ctx.client as unknown as ClientWithTui
      if (!tuiClient?.tui?.publish) {
        log(`[SafeDiagnosticTrigger] Skipped - no publish available`)
        return
      }

      // We use 'publish' to send our custom tui.diagnostic.trigger event
      // that we appended to the openCode core definitions.
      await tuiClient.tui.publish({
        body: {
          type: "tui.diagnostic.trigger",
          properties: {
            diagnosticClass,
            message,
          },
        },
      })
    } catch (err) {
      log(`[SafeDiagnosticTrigger] Failed to publish diagnostic trigger: ${String(err)}`, { error: err })
    }
  }
}
