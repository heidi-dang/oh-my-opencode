import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { runCoverage } from "./cli"
import type { PluginContext } from "../../plugin/types"

export function createTestCoverageAnalyzer(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Runs tests with coverage and identifies exactly which lines are missing test coverage in a file.",
    args: {
      path: tool.schema.string().describe("File or directory path to run tests for (e.g., 'src/shared/utils.ts')"),
    },
    execute: async (args) => {
      try {
        const summary = await runCoverage(args.path, ctx.directory)
        
        if (summary.results.length === 0) {
          return "No coverage data found for the specified path. Ensure the path is correct and contains tests or is covered by tests."
        }

        let output = `### Coverage Summary for ${args.path}\n\n`
        output += `**Total Line Coverage**: ${summary.totalLinesPercent}%\n`
        output += `**Total Function Coverage**: ${summary.totalFunctionsPercent}%\n\n`
        output += "| File | % Lines | Uncovered Lines |\n"
        output += "| :--- | :--- | :--- |\n"

        for (const res of summary.results) {
          output += `| ${res.file} | ${res.linesPercent}% | ${res.uncoveredLines || "None"} |\n`
        }

        return output
      } catch (error) {
        return `Error analyzing coverage: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
