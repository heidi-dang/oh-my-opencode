import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { checkModuleHealth } from "./checker"

export function createModuleHealthCheck(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Checks if code follows the project's health rules (LOC limits, banned filenames, no 'as any', etc.).",
    args: {
      path: tool.schema.string().describe("Directory or file path to check (e.g., 'src/shared')"),
    },
    execute: async (args) => {
      try {
        const issues = await checkModuleHealth(args.path, ctx.directory)
        
        if (issues.length === 0) {
          return "✨ No health issues found in " + args.path
        }

        let output = `### Module Health Issues for ${args.path}\n\n`
        output += "| File | Rule | Severity | Message |\n"
        output += "| :--- | :--- | :--- | :--- |\n"
        
        for (const issue of issues) {
          output += `| ${issue.file} | ${issue.rule} | ${issue.severity === "error" ? "🔴" : "🟡"} | ${issue.message} |\n`
        }

        return output
      } catch (error) {
        return `Error checking module health: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
