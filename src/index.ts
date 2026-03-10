import { initConfigContext } from "./cli/config-manager/config-context"
import type { Plugin } from "@opencode-ai/plugin"

import type { HookName } from "./config"

import { createHooks } from "./create-hooks"
import { createManagers } from "./create-managers"
import { createTools } from "./create-tools"
import { createPluginInterface } from "./plugin-interface"

import { loadPluginConfig } from "./plugin-config"
import { createModelCacheState } from "./plugin-state"
import { createFirstMessageVariantGate } from "./shared/first-message-variant"
import { injectServerAuthIntoClient, log, injectYGKAInterceptor } from "./shared"
import { startTmuxCheck } from "./tools"

const OhMyOpenCodePlugin: Plugin = async (ctx) => {
  // Initialize config context for plugin runtime (prevents warnings from hooks)
  initConfigContext("opencode", null)
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

  // Cleanup on shutdown
  process.on("SIGTERM", () => {
    log("[OhMyOpenCodePlugin] SIGTERM received. Shutting down managers.")
    managers.runStateWatchdogManager.stop()
  })

  process.on("exit", () => {
    log("[OhMyOpenCodePlugin] Process exit. Ensuring watchdog is stopped.")
    managers.runStateWatchdogManager.stop()
  })

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
