import type { Message, Part } from "@opencode-ai/sdk"

import type { CreatedHooks } from "../create-hooks"
import type { OhMyOpenCodeConfig } from "../config"
import { isSafetyCriticalHookError } from "../shared/safety-critical-hook-error"
import {
  MessagePredicates,
  MessageTransformPipeline,
} from "./handlers/message-transform-pipeline"

type MessageWithParts = {
  info: Message
  parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

export function createMessagesTransformHandler(args: {
  hooks: CreatedHooks
  pluginConfig?: OhMyOpenCodeConfig
}): (input: Record<string, never>, output: MessagesTransformOutput) => Promise<void> {
  const pipeline = new MessageTransformPipeline()
  pipeline.addTransform({
    name: "notEmpty",
    predicate: MessagePredicates.notEmpty,
    transform: (message) => message,
    priority: 0,
    required: true,
  })

  return async (input, output): Promise<void> => {
    try {
      await args.hooks.runtimeEnforcement?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

      const criticalTransformError = (output as MessagesTransformOutput & { __criticalTransformError?: Error }).__criticalTransformError
      if (criticalTransformError) {
        throw criticalTransformError
      }

      await args.hooks.contextInjectorMessagesTransform?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

      await args.hooks.thinkingBlockValidator?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

      await args.hooks.anthropicPromptCaching?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

      await args.hooks.carRuntime?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

      await args.hooks.proactiveThinker?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

      const enablePredicatePipeline = args.pluginConfig?.performance?.enableMessagePredicatePipeline ?? true
      if (enablePredicatePipeline) {
        const indexedMessages = output.messages.map((message, index) => ({
          id: String(index),
          role: message.info.role,
          content: message.parts
            .filter((part): part is Part & { text: string } => part.type === "text" && typeof (part as { text?: unknown }).text === "string")
            .map((part) => part.text)
            .join("\n") || undefined,
          parts: message.parts,
        }))
        const filtered = pipeline.process(indexedMessages, { measurePerformance: true, logSkipped: false })
        const allowedIndexes = new Set(filtered.map((message) => Number(message.id)))
        output.messages = output.messages.filter((_message, index) => allowedIndexes.has(index))
      }
    } catch (error) {
      if (isSafetyCriticalHookError(error)) {
        throw error
      }

      console.error("[Transform Boundary Error] Caught unhandled exception in message transform:", error)
      // We log but DO NOT throw, to ensure the session rendering loop remains intact.
    }
  }
}
