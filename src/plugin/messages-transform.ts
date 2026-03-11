import type { Message, Part } from "@opencode-ai/sdk"

import type { CreatedHooks } from "../create-hooks"

type MessageWithParts = {
  info: Message
  parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

export function createMessagesTransformHandler(args: {
  hooks: CreatedHooks
}): (input: Record<string, never>, output: MessagesTransformOutput) => Promise<void> {
  return async (input, output): Promise<void> => {
    try {
      await args.hooks.runtimeEnforcement?.[
        "experimental.chat.messages.transform"
      ]?.(input, output)

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
    } catch (error) {
      console.error("[Transform Boundary Error] Caught unhandled exception in message transform:", error)
      // We log but DO NOT throw, to ensure the session rendering loop remains intact.
    }
  }
}
