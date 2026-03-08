import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { runBench } from "./benchmarker"

export function createPerformanceBenchmarker(ctx: { directory: string }): ToolDefinition {
  return tool({
    description: "Runs performance benchmarks using 'bun test --bench' for a given file.",
    args: {
      path: tool.schema.string().describe("Path to the benchmark file (e.g., 'src/shared/math.bench.ts')"),
    },
    execute: async (args) => {
      try {
        const output = await runBench(args.path, ctx.directory)
        return `### Performance Benchmark Results for ${args.path}\n\n` + "```\n" + output + "\n```"
      } catch (error) {
        return `Error running benchmarks: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
