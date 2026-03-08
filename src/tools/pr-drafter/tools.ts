import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { getDiff, getCommitMessages } from "./analyzer"

export function createPrDrafter(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Analyzes current changes and drafts a high-quality PR description.",
    args: {
      baseBranch: tool.schema.string().optional().describe("The base branch to compare against (default: 'main')"),
    },
    execute: async (args) => {
      const base = args.baseBranch ?? "main"
      try {
        const diff = await getDiff(ctx.directory, base)
        const commits = await getCommitMessages(ctx.directory, base)

        if (!diff) {
          return "No differences found between current branch and " + base
        }

        let draft = "# Pull Request\n\n## Summary\n"
        draft += "Explain the high-level goal of these changes here.\n\n"
        
        draft += "## Commits\n"
        for (const commit of commits) {
          draft += `- ${commit}\n`
        }

        draft += "\n## Key Changes\n"
        // Heuristic analysis of diff could go here
        draft += "### Core Logic\n- List core logic changes here.\n"
        draft += "### Tests\n- List test changes here.\n"
        
        draft += "\n## Verification Results\n"
        draft += "Describe how you verified these changes.\n"

        return draft
      } catch (error) {
        return `Error drafting PR: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
