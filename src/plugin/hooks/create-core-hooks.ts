import type { HookName, OhMyOpenCodeConfig } from "../../config"
import type { PluginContext } from "../types"
import type { ModelCacheState } from "../../plugin-state"
import type { RunStateWatchdogManager } from "../../features/run-state-watchdog"

import { createSessionHooks, type SessionHooks } from "./create-session-hooks"
import { createToolGuardHooks, type ToolGuardHooks } from "./create-tool-guard-hooks"
import { createTransformHooks, type TransformHooks } from "./create-transform-hooks"

export type CoreHooks = SessionHooks & ToolGuardHooks & TransformHooks

export function createCoreHooks(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  modelCacheState: ModelCacheState
  runStateWatchdogManager: RunStateWatchdogManager
  isHookEnabled: (hookName: HookName) => boolean
  safeHookEnabled: boolean
  firstMessageVariantGate?: { shouldOverride: (sessionID: string) => boolean }
}) {
  const { ctx, pluginConfig, modelCacheState, runStateWatchdogManager, isHookEnabled, safeHookEnabled, firstMessageVariantGate = { shouldOverride: () => false } } = args

  const session = createSessionHooks({
    ctx,
    pluginConfig,
    modelCacheState,
    runStateWatchdogManager,
    isHookEnabled,
    safeHookEnabled,
  })

  const tool = createToolGuardHooks({
    ctx,
    pluginConfig,
    modelCacheState,
    isHookEnabled,
    safeHookEnabled,
  })

  const transform = createTransformHooks({
    ctx,
    pluginConfig,
    isHookEnabled: (name) => isHookEnabled(name as HookName),
    safeHookEnabled,
    firstMessageVariantGate,
  })

  return {
    ...session,
    ...tool,
    ...transform,
  }
}
