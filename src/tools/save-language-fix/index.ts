import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { PluginContext } from "../../plugin/types"
import { LanguageMemory } from "../../features/language-intelligence/language-memory"

export function createSaveLanguageFixTool(ctx: PluginContext): ToolDefinition {
  return tool({
    description: "Save a successful bug fix or implementation pattern to persistent memory, keyed by the repository's primary language. Use this after successfully resolving a complex language-specific bug (e.g., TS typing issues, tricky pytest failures) so the agent remembers it across all future sessions in this repo.",
    args: {
      language: tool.schema.string().describe("The specific language this fix applies to (e.g., 'Python', 'TypeScript', 'Rust')."),
      errorSignature: tool.schema.string().describe("The core error message, concept, or structural pattern this fixes (e.g., 'TS2339 property does not exist', 'pytest fixture not found')."),
      fixDescription: tool.schema.string().describe("A concise but complete description of the fix, ideally including a small code snippet showing the resolution pattern."),
    },
    async execute({ language, errorSignature, fixDescription }) {
      try {
        const memory = new LanguageMemory()
        const id = memory.saveFix(language, errorSignature, fixDescription)
        return `✅ Successfully saved language fix for '${language}' (ref ${id}). This will be injected as context in all future sessions for this language.`
      } catch (err) {
        return `Failed to save language fix: ${(err as Error).message}`
      }
    },
  })
}


