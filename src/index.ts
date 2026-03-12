import { initConfigContext } from "./cli/config-manager/config-context"
import type { Plugin } from "@opencode-ai/plugin"

import type { HookName } from "./config"

import { createHooks } from "./create-hooks"
import { createManagers } from "./create-managers"
import { createTools } from "./create-tools"
import { createPluginInterface } from "./plugin-interface"

import { loadPluginConfig } from "./plugin-config"
import { createModelCacheState } from "./plugin-state"
import { initializePerformanceOptimizations } from "./shared/performance-integration"
import { createFirstMessageVariantGate } from "./shared/first-message-variant"
import { injectServerAuthIntoClient, log, injectYGKAInterceptor } from "./shared"
import { startTmuxCheck } from "./tools"

/**
 * Detect and decode base64-encoded directory paths.
 *
 * The OpenCode server sometimes encodes the workspace directory as base64
 * before passing it to plugins. A valid Unix directory starts with "/" and
 * a valid Windows directory starts with a drive letter (e.g. "C:\").
 * If neither is true and the string is valid base64 that decodes to an
 * absolute path, we use the decoded version.
 */
function resolveDirectory(raw: string): string {
  if (!raw) return raw

  const looksAbsolute = raw.startsWith("/") || /^[A-Za-z]:[/\\]/.test(raw)
  if (looksAbsolute) return raw

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8")
    if (decoded.startsWith("/") || /^[A-Za-z]:[/\\]/.test(decoded)) {
      return decoded
    }
  } catch {
    // Not valid base64 — keep as-is
  }

  return raw
}

const OhMyOpenCodePlugin: Plugin = async (ctx) => {
  // Initialize config context for plugin runtime (prevents warnings from hooks)
  initConfigContext("opencode", null)

  // Decode base64-encoded directory if the server passed one
  const resolvedDir = resolveDirectory(ctx.directory)
  if (resolvedDir !== ctx.directory) {
    log("[OhMyOpenCodePlugin] Decoded base64 directory", {
      raw: ctx.directory,
      decoded: resolvedDir,
    })
    ;(ctx as any).directory = resolvedDir
  }

  log("[OhMyOpenCodePlugin] ENTRY - plugin loading", {
    directory: ctx.directory,
  })

  injectServerAuthIntoClient(ctx.client)
  injectYGKAInterceptor(ctx.client)
  startTmuxCheck()

  // --- GLOBAL ERROR PROTECTION ---
  process.on("unhandledRejection", (reason, _promise) => {
    log("[OhMyOpenCodePlugin] UNHANDLED REJECTION:", { reason: String(reason) })
  })

  process.on("uncaughtException", (error) => {
    log("[OhMyOpenCodePlugin] UNCAUGHT EXCEPTION:", { error: error.message, stack: error.stack })
  })
  // -------------------------------

  const pluginConfig = loadPluginConfig(ctx.directory, ctx)
  initializePerformanceOptimizations(pluginConfig, ctx)
  const disabledHooks = new Set(pluginConfig.disabled_hooks ?? [])

  const isHookEnabled = (hookName: HookName): boolean => !disabledHooks.has(hookName)
  const safeHookEnabled = pluginConfig.experimental?.safe_hook_creation ?? true

  const firstMessageVariantGate = createFirstMessageVariantGate()

  const tmuxConfig = {
    enabled: pluginConfig.tmux?.enabled ?? false,
    layout: pluginConfig.tmux?.layout ?? "main-vertical",
    main_pane_size: pluginConfig.tmux?.main_pane_size ?? 60,
    main_pane_min_width: pluginConfig.tmux?.main_pane_min_width ?? 120,
    agent_pane_min_width: pluginConfig.tmux?.agent_pane_min_width ?? 40,
  }

  const modelCacheState = createModelCacheState()

  const managers = createManagers({
    ctx,
    pluginConfig,
    tmuxConfig,
    modelCacheState,
    backgroundNotificationHookEnabled: isHookEnabled("background-notification"),
  })

  const toolsResult = await createTools({
    ctx,
    pluginConfig,
    managers,
  })
  const hooks = createHooks({
    ctx,
    pluginConfig,
    modelCacheState,
    backgroundManager: managers.backgroundManager,
    runStateWatchdogManager: managers.runStateWatchdogManager,
    isHookEnabled,
    safeHookEnabled,
    firstMessageVariantGate,
    mergedSkills: toolsResult.mergedSkills,
    availableSkills: toolsResult.availableSkills,
  })

  const pluginInterface = createPluginInterface({
    ctx,
    pluginConfig,
    firstMessageVariantGate,
    managers,
    hooks,
    tools: toolsResult.filteredTools,
  })

  // Cleanup on shutdown — full signal coverage for 10/10 stability
  const gracefulShutdown = (signal: string) => {
    log(`[OhMyOpenCodePlugin] ${signal} received. Shutting down managers.`)
    managers.runStateWatchdogManager.stop()
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))
  process.on("SIGHUP", () => gracefulShutdown("SIGHUP"))
  process.on("exit", () => gracefulShutdown("exit"))

  return {
    ...pluginInterface,

    "experimental.session.compacting": async (
      _input: { sessionID: string },
      output: { context: string[] },
    ): Promise<void> => {
      await hooks.compactionTodoPreserver?.capture(_input.sessionID)
      await hooks.claudeCodeHooks?.["experimental.session.compacting"]?.(
        _input,
        output,
      )
      if (hooks.compactionContextInjector) {
        output.context.push(hooks.compactionContextInjector(_input.sessionID))
      }
    },
  }
}

export default OhMyOpenCodePlugin

export type {
  OhMyOpenCodeConfig,
  AgentName,
  AgentOverrideConfig,
  AgentOverrides,
  McpName,
  HookName,
  BuiltinCommandName,
} from "./config"

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Config error utilities are available via "./shared/config-errors" for internal use only.
export type { ConfigLoadError } from "./shared/config-errors"
