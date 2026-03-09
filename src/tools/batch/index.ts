import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import { tool, type ToolDefinition, type ToolContext } from "@opencode-ai/plugin/tool"
import { runRg } from "../grep/cli"
import { formatGrepResult } from "../grep/result-formatter"
import { ContextTrimmer } from "../../utils/context-trimmer"

interface BatchReadArgs {
  filePaths: string[]
  maxLinesPerFile?: number
}

interface GrepQuery {
  pattern: string
  include?: string
  path?: string
  output_mode?: "content" | "files_with_matches" | "count"
}

interface BatchGrepArgs {
  queries: GrepQuery[]
}

export function createBatchReadTool(): ToolDefinition {
  return tool({
    description: "Read multiple files in a single call. returns all file contents or error messages mapped by path.",
    args: {
      filePaths: tool.schema.array(tool.schema.string()).describe("List of absolute or relative file paths to read"),
      maxLinesPerFile: tool.schema.number().optional().describe("Maximum lines to read per file. Defaults to 50 for large batches.")
    },
    execute: async (args: BatchReadArgs, context: ToolContext) => {
      const { filePaths, maxLinesPerFile = 50 } = args
      const contextDir = context.directory || process.cwd()
      
      const results: Record<string, string> = {}
      
      const readPromises = filePaths.map(async (filePath) => {
        const fullPath = resolve(contextDir, filePath)
        try {
          const content = await fs.readFile(fullPath, "utf8")
          const lines = content.split("\n")
          if (lines.length > maxLinesPerFile) {
            results[filePath] = lines.slice(0, maxLinesPerFile).join("\n") + `\n\n// ... [TRUNCATED - Showing first ${maxLinesPerFile} lines]`
          } else {
            results[filePath] = content
          }
        } catch (err: any) {
          results[filePath] = `Error: ${err.message}`
        }
      })
      
      await Promise.all(readPromises)
      return JSON.stringify(results, null, 2)
    }
  })
}

export function createBatchGrepTool(pluginCtx: any): ToolDefinition {
  return tool({
    description: "Execute multiple grep searches in parallel. Useful for researching multiple patterns across different parts of a project simultaneously.",
    args: {
      queries: tool.schema.array(
        tool.schema.object({
          pattern: tool.schema.string().describe("Regex pattern"),
          include: tool.schema.string().optional().describe("Glob filter"),
          path: tool.schema.string().optional().describe("Search directory"),
          output_mode: tool.schema.enum(["content", "files_with_matches", "count"]).optional()
        })
      ).describe("List of grep queries to execute")
    },
    execute: async (args: BatchGrepArgs, context: ToolContext) => {
      const { queries } = args
      const contextDir = context.directory || process.cwd()
      
      const queryPromises = queries.map(async (q) => {
        const searchPath = q.path ? resolve(contextDir, q.path) : contextDir
        try {
          const result = await runRg({
            pattern: q.pattern,
            paths: [searchPath],
            globs: q.include ? [q.include] : undefined,
            outputMode: q.output_mode || "files_with_matches",
            context: 0
          })
          
          return {
            query: q.pattern,
            result: formatGrepResult(result)
          }
        } catch (err: any) {
          return {
            query: q.pattern,
            error: err.message
          }
        }
      })
      
      const results = await Promise.all(queryPromises)
      return JSON.stringify(results, null, 2)
    }
  })
}
