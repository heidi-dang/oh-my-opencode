import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../../shared/logger"
import { SafeToastWrapper } from "../../../shared/safe-toast-wrapper"
import { showSpinnerToast } from "./spinner-toast"

export function showVersionToast(ctx: PluginInput, version: string | null, message: string): void {
  const displayVersion = version ?? "unknown"
  showSpinnerToast(ctx, displayVersion, message)
  log(`[auto-update-checker] Startup toast shown: v${displayVersion}`)
}

export function showLocalDevToast(
  ctx: PluginInput,
  version: string | null,
  isSisyphusEnabled: boolean
): void {
  const displayVersion = version ?? "dev"
  const message = isSisyphusEnabled
    ? "Sisyphus running in local development mode."
    : "Running in local development mode. oMoMoMo..."
  showSpinnerToast(ctx, `${displayVersion} (dev)`, message)
  log(`[auto-update-checker] Local dev toast shown: v${displayVersion}`)
}
