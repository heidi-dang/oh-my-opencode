import type { PluginInput } from "@opencode-ai/plugin"
import { getConfigLoadErrors, clearConfigLoadErrors } from "../../../shared/config-errors"
import { log } from "../../../shared/logger"
import { SafeToastWrapper } from "../../../shared/safe-toast-wrapper"

export function showConfigErrorsIfAny(ctx: PluginInput): void {
  const errors = getConfigLoadErrors()
  if (errors.length === 0) return

  const errorMessages = errors.map((error: { path: string; error: string }) => `${error.path}: ${error.error}`).join("\n")
  
  SafeToastWrapper.showError(
    ctx,
    "Config Load Error",
    `Failed to load config:\n${errorMessages}`,
    "auto-update-config-errors"
  )

  log(`[auto-update-checker] Config load errors shown: ${errors.length} error(s)`) 
  clearConfigLoadErrors()
}
