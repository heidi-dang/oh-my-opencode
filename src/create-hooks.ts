import type { AvailableSkill } from "./agents/types"
import type { HookName, OhMyOpenCodeConfig } from "./config"
import type { LoadedSkill } from "./features/opencode-skill-loader/types"
import type { BackgroundManager } from "./features/background-agent"
import type { RunStateWatchdogManager } from "./features/run-state-watchdog"
import type { PluginContext } from "./plugin/types"
import type { ModelCacheState } from "./plugin-state"

import { createCoreHooks } from "./plugin/hooks/create-core-hooks"
import { createContinuationHooks } from "./plugin/hooks/create-continuation-hooks"
import { createSkillHooks } from "./plugin/hooks/create-skill-hooks"

import type { CoreHooks } from "./plugin/hooks/create-core-hooks"
import type { ContinuationHooks } from "./plugin/hooks/create-continuation-hooks"
import type { SkillHooks } from "./plugin/hooks/create-skill-hooks"

export type CreatedHooks = CoreHooks & ContinuationHooks & SkillHooks

export function createHooks(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  modelCacheState: ModelCacheState
  backgroundManager: BackgroundManager
  runStateWatchdogManager: RunStateWatchdogManager
  isHookEnabled: (hookName: HookName) => boolean
  safeHookEnabled: boolean
  firstMessageVariantGate: {
    shouldOverride: (sessionID: string) => boolean
    markApplied: (sessionID: string) => void
    markSessionCreated: (sessionInfo: { id?: string; title?: string; parentID?: string } | undefined) => void
    clear: (sessionID: string) => void
  }
  mergedSkills: LoadedSkill[]
  availableSkills: AvailableSkill[]
}): CreatedHooks {
  const {
    ctx,
    pluginConfig,
    modelCacheState,
    backgroundManager,
    runStateWatchdogManager,
    isHookEnabled,
    safeHookEnabled,
    firstMessageVariantGate,
    mergedSkills,
    availableSkills,
  } = args

  const core = createCoreHooks({
    ctx,
    pluginConfig,
    modelCacheState,
    runStateWatchdogManager,
    isHookEnabled,
    safeHookEnabled,
    firstMessageVariantGate,
  })

  const continuation = createContinuationHooks({
    ctx,
    pluginConfig,
    isHookEnabled,
    safeHookEnabled,
    backgroundManager,
    sessionRecovery: core.sessionRecovery,
  })

  const skill = createSkillHooks({
    ctx,
    pluginConfig,
    isHookEnabled,
    safeHookEnabled,
    mergedSkills,
    availableSkills,
  })

  return {
    ...core,
    ...continuation,
    ...skill,
  }
}
