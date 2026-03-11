import type { ToolDefinition } from "@opencode-ai/plugin"

import type {
  AvailableCategory,
} from "../agents/types"
import type { OhMyOpenCodeConfig } from "../config"
import type { PluginContext, ToolsRecord } from "./types"

import {
  builtinTools,
  createBackgroundTools,
  createCallOmoAgent,
  createLookAt,
  createSkillMcpTool,
  createSkillTool,
  createGrepTools,
  createGlobTools,
  createAstGrepTools,
  createSessionManagerTools,
  createDelegateTask,
  discoverCommandsSync,
  interactive_bash,
  createTaskCreateTool,
  createTaskGetTool,
  createTaskList,
  createTaskUpdateTool,
  createHashlineEditTool,
  createMemoryBankTools,
  createMultiReplaceTool,
  createBatchReadTool,
  createBatchGrepTool,
  createRecallMemoryTool,
  createSaveLanguageFixTool,
  createAutonomousDiagnoseTool,
} from "../tools"
import { getMainSessionID } from "../features/claude-code-session-state"
import { filterDisabledTools } from "../shared/disabled-tools"
import { log } from "../shared"
import { DETERMINISTIC_TOOLS } from "../runtime/tools/registry"

import type { Managers } from "../create-managers"
import type { SkillContext } from "./skill-context"

export type ToolRegistryResult = {
  filteredTools: ToolsRecord
  taskSystemEnabled: boolean
}

export function createToolRegistry(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  managers: Pick<Managers, "backgroundManager" | "tmuxSessionManager" | "skillMcpManager">
  skillContext: SkillContext
  availableCategories: AvailableCategory[]
}): ToolRegistryResult {
  const { ctx, pluginConfig, managers, skillContext, availableCategories } = args

  const backgroundTools = createBackgroundTools(managers.backgroundManager, ctx.client)
  const callOmoAgent = createCallOmoAgent(ctx, managers.backgroundManager, pluginConfig.disabled_agents ?? [])

  const isMultimodalLookerEnabled = !(pluginConfig.disabled_agents ?? []).some(
    (agent) => agent.toLowerCase() === "multimodal-looker",
  )
  const lookAt = isMultimodalLookerEnabled ? createLookAt(ctx) : null

  const delegateTask = createDelegateTask({
    manager: managers.backgroundManager,
    client: ctx.client,
    directory: ctx.directory,
    userCategories: pluginConfig.categories,
    agentOverrides: pluginConfig.agents,
    gitMasterConfig: pluginConfig.git_master,
    sisyphusJuniorModel: pluginConfig.agents?.["sisyphus-junior"]?.model,
    browserProvider: skillContext.browserProvider,
    disabledSkills: skillContext.disabledSkills,
    availableCategories,
    availableSkills: skillContext.availableSkills,
    syncPollTimeoutMs: pluginConfig.background_task?.syncPollTimeoutMs,
    onSyncSessionCreated: async (event) => {
      log("[index] onSyncSessionCreated callback", {
        sessionID: event.sessionID,
        parentID: event.parentID,
        title: event.title,
      })
      await managers.tmuxSessionManager.onSessionCreated({
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
  })

  const getSessionIDForMcp = (): string => getMainSessionID() || ""

  const skillMcpTool = createSkillMcpTool({
    manager: managers.skillMcpManager,
    getLoadedSkills: () => skillContext.mergedSkills,
    getSessionID: getSessionIDForMcp,
  })

  const commands = discoverCommandsSync(ctx.directory, {
    pluginsEnabled: pluginConfig.claude_code?.plugins ?? true,
    enabledPluginsOverride: pluginConfig.claude_code?.plugins_override,
  })
  const skillTool = createSkillTool({
    commands,
    skills: skillContext.mergedSkills,
    mcpManager: managers.skillMcpManager,
    getSessionID: getSessionIDForMcp,
    gitMasterConfig: pluginConfig.git_master,
  })

  const taskSystemEnabled = pluginConfig.experimental?.task_system ?? false
  const taskToolsRecord: Record<string, ToolDefinition> = taskSystemEnabled
    ? {
      task_create: createTaskCreateTool(pluginConfig, ctx),
      task_get: createTaskGetTool(pluginConfig),
      task_list: createTaskList(pluginConfig),
      task_update: createTaskUpdateTool(pluginConfig, ctx),
    }
    : {}

  const hashlineEnabled = pluginConfig.hashline_edit ?? false
  const hashlineToolsRecord: Record<string, ToolDefinition> = hashlineEnabled
    ? { edit: createHashlineEditTool() }
    : {}

  const wrap = (name: string, toolDef: ToolDefinition) => toolDef

  const allTools: Record<string, ToolDefinition> = {
    ...builtinTools,
    grep: wrap("grep", createGrepTools(ctx).grep),
    glob: wrap("glob", createGlobTools(ctx).glob),
    ...createAstGrepTools(ctx),
    ...createSessionManagerTools(ctx),
    ...backgroundTools,
    call_omo_agent: callOmoAgent,
    ...(lookAt ? { look_at: lookAt } : {}),
    task: delegateTask,
    skill_mcp: skillMcpTool,
    skill: skillTool,
    interactive_bash: wrap("interactive_bash", interactive_bash),
    ...taskToolsRecord,
    ...hashlineToolsRecord,
    ...createMemoryBankTools(),
    multi_replace_file_content: wrap("multi_replace_file_content", createMultiReplaceTool()),
    batch_read: wrap("batch_read", createBatchReadTool()),
    batch_grep: wrap("batch_grep", createBatchGrepTool(ctx)),
    recall_memory: createRecallMemoryTool(),
    save_language_fix: createSaveLanguageFixTool(ctx),
  
    git_safe: wrap("git_safe", DETERMINISTIC_TOOLS["git_safe"]()),
    fs_safe: wrap("fs_safe", DETERMINISTIC_TOOLS["fs_safe"]()),
    verify_action: DETERMINISTIC_TOOLS["verify_action"](),
    submit_plan: DETERMINISTIC_TOOLS["submit_plan"](),
    mark_step_complete: DETERMINISTIC_TOOLS["mark_step_complete"](),
    unlock_plan: DETERMINISTIC_TOOLS["unlock_plan"](),
    query_ledger: DETERMINISTIC_TOOLS["query_ledger"]({ backgroundManager: managers.backgroundManager }),
    complete_task: DETERMINISTIC_TOOLS["complete_task"]({ client: ctx.client, backgroundManager: managers.backgroundManager }),
    report_issue_verification: DETERMINISTIC_TOOLS["report_issue_verification"](),
    gh_safe: wrap("gh_safe", DETERMINISTIC_TOOLS["gh_safe"]()),
    ...(builtinTools.read_file ? { read_file: wrap("read_file", builtinTools.read_file) } : {}),
    ...(builtinTools.write_file ? { write_file: wrap("write_file", builtinTools.write_file) } : {}),
    autonomous_diagnose: createAutonomousDiagnoseTool(),
  }

  const filteredTools = filterDisabledTools(allTools, pluginConfig.disabled_tools)

  return {
    filteredTools,
    taskSystemEnabled,
  }
}
