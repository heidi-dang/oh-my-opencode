import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { validateEnv } from "./validator"

export function createEnvValidator(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Validates the local .env file against .env.example and checks for missing keys.",
    args: {},
    execute: async (_args) => {
      try {
        const result = validateEnv(ctx.directory)
        
        if (result.missingKeys.length === 0 && result.extraKeys.length === 0) {
          return "✅ .env is perfectly in sync with .env.example"
        }

        let output = "### Environment Validation\n\n"
        if (result.missingKeys.length > 0) {
          output += "#### ❌ Missing Keys (present in .env.example but not in .env)\n"
          output += result.missingKeys.map(k => `- ${k}`).join("\n") + "\n\n"
        }
        if (result.extraKeys.length > 0) {
          output += "#### ℹ️ Extra Keys (present in .env but not in .env.example)\n"
          output += result.extraKeys.map(k => `- ${k}`).join("\n") + "\n\n"
        }

        return output
      } catch (error) {
        return `Error validating env: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
