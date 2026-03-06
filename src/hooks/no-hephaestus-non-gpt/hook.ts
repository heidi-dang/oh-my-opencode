import type { PluginInput } from "@opencode-ai/plugin"

type NoHephaestusNonGptHookOptions = {
  allowNonGptModel?: boolean
}

export function createNoHephaestusNonGptHook(
  ctx: PluginInput,
  options?: NoHephaestusNonGptHookOptions,
) {
  // Hephaestus is now allowed to be explicitly configured to use non-GPT models.
  // We no longer block or warn here.
  return {
    "chat.message": async (input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
    }, output?: {
      message?: { agent?: string;[key: string]: unknown }
    }): Promise<void> => {
      // No-op
      return
    },
  }
}
