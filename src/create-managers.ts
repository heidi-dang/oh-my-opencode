import type { OhMyOpenCodeConfig } from "./config"
import type { ModelCacheState } from "./plugin-state"
import type { PluginContext, TmuxConfig } from "./plugin/types"

import type { SubagentSessionCreatedEvent } from "./features/background-agent"
import { BackgroundManager } from "./features/background-agent"
import { SkillMcpManager } from "./features/skill-mcp-manager"
import { initTaskToastManager } from "./features/task-toast-manager"
import { RunStateWatchdogManager } from "./features/run-state-watchdog"
import { TmuxSessionManager } from "./features/tmux-subagent"
import { createConfigHandler } from "./plugin-handlers"
import { log } from "./shared"


export type Managers = {
  tmuxSessionManager: TmuxSessionManager
  backgroundManager: BackgroundManager
  skillMcpManager: SkillMcpManager
  runStateWatchdogManager: RunStateWatchdogManager
  configHandler: ReturnType<typeof createConfigHandler>
  
}

export function createManagers(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  tmuxConfig: TmuxConfig
  modelCacheState: ModelCacheState
  backgroundNotificationHookEnabled: boolean
}): Managers {
  const { ctx, pluginConfig, tmuxConfig, modelCacheState, backgroundNotificationHookEnabled } = args

  const tmuxSessionManager = new TmuxSessionManager(ctx, tmuxConfig)

  const backgroundManager = new BackgroundManager(
    ctx,
    pluginConfig.background_task,
    {
      tmuxConfig,
      onSubagentSessionCreated: async (event: SubagentSessionCreatedEvent) => {
        await tmuxSessionManager.onSessionCreated({
          type: "session.created",
          properties: {
            info: {
              id: event.sessionID,
              parentID: event.parentID,
              title: event.title,
            },
          },
        })
      },
      onShutdown: () => {
        tmuxSessionManager.cleanup().catch((error) => {
          log("[index] tmux cleanup error during shutdown:", error)
        })
      },
      enableParentSessionNotifications: backgroundNotificationHookEnabled,
    },
  )

  initTaskToastManager(ctx.client)

  const skillMcpManager = new SkillMcpManager()
  
  const runStateWatchdogManager = new RunStateWatchdogManager(ctx.client)
  runStateWatchdogManager.start()

  const configHandler = createConfigHandler({
    ctx: { directory: ctx.directory, client: ctx.client },
    pluginConfig,
    modelCacheState,
  })

  const result: Managers = {
    tmuxSessionManager,
    backgroundManager,
    skillMcpManager,
    runStateWatchdogManager,
    configHandler,
  }
  return result
}
