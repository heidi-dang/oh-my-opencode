import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { verifyApiContract } from "./verifier"

export function createApiContractVerifier(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Validates if a hook or tool implementation follows the project's API contracts and factory patterns.",
    args: {
      path: tool.schema.string().describe("Path to the file to verify (e.g., 'src/hooks/my-hook/index.ts')"),
    },
    execute: async (args) => {
      try {
        const issues = verifyApiContract(args.path, ctx.directory)
        if (issues.length === 0) {
          return "✅ API contract verified for " + args.path
        }

        let output = `### API Contract Issues for ${args.path}\n\n`
        for (const issue of issues) {
          output += `- **${issue.rule}** (${issue.severity === "error" ? "🔴" : "🟡"}): ${issue.message}\n`
        }
        return output
      } catch (error) {
        return `Error verifying API contract: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
