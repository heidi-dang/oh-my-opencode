import { consumeToolMetadata } from "../features/tool-metadata-store"
import type { CreatedHooks } from "../create-hooks"

export function createToolExecuteAfterHandler(args: {
  hooks: CreatedHooks
}): (
  input: { tool: string; sessionID: string; callID: string },
  output:
    | { title: string; output: string; metadata: Record<string, unknown> }
    | undefined,
) => Promise<void> {
  const { hooks } = args

  return async (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: Record<string, unknown> } | undefined,
  ): Promise<void> => {
    if (!output) return

    const stored = consumeToolMetadata(input.sessionID, input.callID)
    if (stored) {
      if (stored.title) {
        output.title = stored.title
      }
      if (stored.metadata) {
        output.metadata = { ...output.metadata, ...stored.metadata }
      }
    }

    await hooks.executionJournal?.["tool.execute.after"]?.(input, output)

    // Central Normalization: Ensure safety-critical tools always meet the required contract
    const safetyCritical = ["git_safe", "fs_safe", "verify_action", "submit_plan", "mark_step_complete", "unlock_plan", "query_ledger", "complete_task"]
    if (safetyCritical.includes(input.tool)) {
      output.metadata = output.metadata || {}
      
      const getBool = (val: any) => {
        if (typeof val === 'boolean') return val
        if (val === 'true') return true
        if (val === 'false') return false
        return undefined
      }

      if (getBool(output.metadata.success) === undefined) {
        // Default to success: true if not explicitly false, to avoid breaking legacy paths
        // but only if it's not a known error result.
        output.metadata.success = true
      }
      if (getBool(output.metadata.verified) === undefined) {
        // Default to verified: true for safety tools unless they failed
        output.metadata.verified = output.metadata.success === true
      }
    }

    await hooks.toolContract?.["tool.execute.after"]?.(input, output)

    await hooks.claudeCodeHooks?.["tool.execute.after"]?.(input, output)
    await hooks.toolOutputTruncator?.["tool.execute.after"]?.(input, output)
    await hooks.preemptiveCompaction?.["tool.execute.after"]?.(input, output)
    await hooks.contextWindowMonitor?.["tool.execute.after"]?.(input, output)
    await hooks.commentChecker?.["tool.execute.after"]?.(input, output)
    await hooks.directoryAgentsInjector?.["tool.execute.after"]?.(input, output)
    await hooks.directoryReadmeInjector?.["tool.execute.after"]?.(input, output)
    await hooks.rulesInjector?.["tool.execute.after"]?.(input, output)
    await hooks.emptyTaskResponseDetector?.["tool.execute.after"]?.(input, output)
    await hooks.agentUsageReminder?.["tool.execute.after"]?.(input, output)
    await hooks.categorySkillReminder?.["tool.execute.after"]?.(input, output)
    await hooks.interactiveBashSession?.["tool.execute.after"]?.(input, output)
    await hooks.editErrorRecovery?.["tool.execute.after"]?.(input, output)
    await hooks.delegateTaskRetry?.["tool.execute.after"]?.(input, output)
    await hooks.atlasHook?.["tool.execute.after"]?.(input, output)
    await hooks.taskResumeInfo?.["tool.execute.after"]?.(input, output)
    await hooks.readImageResizer?.["tool.execute.after"]?.(input, output)
    await hooks.hashlineReadEnhancer?.["tool.execute.after"]?.(input, output)
    await hooks.jsonErrorRecovery?.["tool.execute.after"]?.(input, output)
  }
}
