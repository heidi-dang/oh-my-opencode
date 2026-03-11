import type { PluginInput } from "@opencode-ai/plugin"
import { isModelCacheAvailable } from "../../../shared/model-availability"
import { log } from "../../../shared/logger"
import { SafeToastWrapper } from "../../../shared/safe-toast-wrapper"

export function showModelCacheWarningIfNeeded(ctx: PluginInput): void {
  if (isModelCacheAvailable()) return

  SafeToastWrapper.showWarning(
    ctx,
    "Model Cache Not Found",
    "Run 'opencode models --refresh' or restart OpenCode to populate the models cache for optimal agent model selection.",
    "auto-update-model-cache"
  )

  log("[auto-update-checker] Model cache warning shown")
}
