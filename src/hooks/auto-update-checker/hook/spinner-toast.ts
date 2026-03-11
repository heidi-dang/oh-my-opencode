import type { PluginInput } from "@opencode-ai/plugin"
import { SafeToastWrapper } from "../../../shared/safe-toast-wrapper"

const SISYPHUS_SPINNER = ["·", "•", "●", "○", "◌", "◦", " "]

export function showSpinnerToast(ctx: PluginInput, version: string, message: string): void {
  // Fire-and-forget spinner - never block the update check
  void runSpinnerToast(ctx, version, message)
}

async function runSpinnerToast(ctx: PluginInput, version: string, message: string): Promise<void> {
  const totalDuration = 5000
  const frameInterval = 100
  const totalFrames = Math.floor(totalDuration / frameInterval)

  for (let i = 0; i < totalFrames; i++) {
    const spinner = SISYPHUS_SPINNER[i % SISYPHUS_SPINNER.length]
    
    SafeToastWrapper.showInfo(
      ctx,
      `${spinner} OhMyOpenCode ${version}`,
      message,
      `auto-update-spinner:${version}`
    )

    await new Promise((resolve) => setTimeout(resolve, frameInterval))
  }
}
