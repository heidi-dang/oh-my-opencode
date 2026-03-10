import type { OhMyOpenCodeConfig } from "../../config"
import type { PluginContext } from "../types"

import {
  createClaudeCodeHooksHook,
  createKeywordDetectorHook,
  createThinkingBlockValidatorHook,
  createAnthropicPromptCachingHook,
  createGoalPrimacyHook,
} from "../../hooks"
import {
  contextCollector,
  createContextInjectorMessagesTransformHook,
} from "../../features/context-injector"
import { safeCreateHook } from "../../shared/safe-create-hook"

export type TransformHooks = {
  claudeCodeHooks: ReturnType<typeof createClaudeCodeHooksHook> | null
  keywordDetector: ReturnType<typeof createKeywordDetectorHook> | null
  contextInjectorMessagesTransform: ReturnType<typeof createContextInjectorMessagesTransformHook>
  thinkingBlockValidator: ReturnType<typeof createThinkingBlockValidatorHook> | null
  anthropicPromptCaching: ReturnType<typeof createAnthropicPromptCachingHook> | null
  goalPrimacy: ReturnType<typeof createGoalPrimacyHook> | null
}

export function createTransformHooks(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  isHookEnabled: (name: string) => boolean
  safeHookEnabled: boolean
  firstMessageVariantGate?: { shouldOverride: (sessionID: string) => boolean }
}): TransformHooks {
  const { ctx, pluginConfig, isHookEnabled, safeHookEnabled, firstMessageVariantGate = { shouldOverride: () => false } } = args

  const claudeCodeHooks = isHookEnabled("claude-code-hooks")
    ? safeCreateHook(
        "claude-code-hooks",
        () =>
          createClaudeCodeHooksHook(
            ctx,
            {
              disabledHooks: (pluginConfig.claude_code?.hooks ?? true) ? undefined : true,
              keywordDetectorDisabled: !isHookEnabled("keyword-detector"),
            },
            contextCollector,
          ),
        { enabled: safeHookEnabled },
      )
    : null

  const keywordDetector = isHookEnabled("keyword-detector")
    ? safeCreateHook(
        "keyword-detector",
        () => createKeywordDetectorHook(ctx, contextCollector),
        { enabled: safeHookEnabled },
      )
    : null

  const contextInjectorMessagesTransform =
    createContextInjectorMessagesTransformHook(contextCollector)

  const thinkingBlockValidator = isHookEnabled("thinking-block-validator")
    ? safeCreateHook(
        "thinking-block-validator",
        () => createThinkingBlockValidatorHook(),
        { enabled: safeHookEnabled },
      )
    : null

  const anthropicPromptCaching = isHookEnabled("anthropic-prompt-caching")
    ? safeCreateHook(
        "anthropic-prompt-caching",
        () => createAnthropicPromptCachingHook(),
        { enabled: safeHookEnabled },
      )
    : null

  const goalPrimacy = safeCreateHook(
    "goal-primacy" as any,
    () => createGoalPrimacyHook({ collector: contextCollector, firstMessageVariantGate }),
    { enabled: safeHookEnabled },
  )

  return {
    claudeCodeHooks,
    keywordDetector,
    contextInjectorMessagesTransform,
    thinkingBlockValidator,
    anthropicPromptCaching,
    goalPrimacy,
  }
}
