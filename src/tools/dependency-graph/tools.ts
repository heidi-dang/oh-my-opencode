import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { analyzeDependencies } from "./analyzer"

export function createDependencyGraph(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Generates a Mermaid dependency graph for a given directory.",
    args: {
      path: tool.schema.string().describe("Directory path to analyze (e.g., 'src/shared')"),
    },
    execute: async (args) => {
      try {
        return await analyzeDependencies(args.path, ctx.directory)
      } catch (error) {
        return `Error generating dependency graph: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
