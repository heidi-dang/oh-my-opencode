import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { scaffoldMcpServer } from "./scaffolder"

export function createMcpServerScaffolder(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Scaffolds a new local MCP server template. Useful for quickly extending agent capabilities.",
    args: {
      name: tool.schema.string().describe("The name of the new MCP server (e.g., 'database-explorer')"),
    },
    execute: async (args) => {
      try {
        return await scaffoldMcpServer(args.name, ctx.directory)
      } catch (error) {
        return `Error scaffolding MCP server: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
