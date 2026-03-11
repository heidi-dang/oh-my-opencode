import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import { tool, type ToolDefinition, type ToolContext } from "@opencode-ai/plugin/tool"

export function createReadFileTool(): ToolDefinition {
  return tool({
    description: "Read the content of a file from the filesystem. Returns the file content as a string.",
    args: {
      path: tool.schema.string().describe("The absolute or relative path to the file to read"),
    },
    execute: async (args: { path: string }, context: ToolContext) => {
      const contextDir = context.directory || process.cwd()
      const fullPath = resolve(contextDir, args.path)
      try {
        return await fs.readFile(fullPath, "utf8")
      } catch (err: any) {
        return `Error reading file: ${err.message}`
      }
    },
  })
}

export function createWriteFileTool(): ToolDefinition {
  return tool({
    description: "Write content to a file on the filesystem. Overwrites existing content.",
    args: {
      path: tool.schema.string().describe("The absolute or relative path to the file to write"),
      content: tool.schema.string().describe("The content to write to the file"),
    },
    execute: async (args: { path: string; content: string }, context: ToolContext) => {
      const contextDir = context.directory || process.cwd()
      const fullPath = resolve(contextDir, args.path)
      try {
        await fs.writeFile(fullPath, args.content, "utf8")
        return `Successfully wrote to ${args.path}`
      } catch (err: any) {
        return `Error writing file: ${err.message}`
      }
    },
  })
}

export function createLsTool(): ToolDefinition {
  return tool({
    description: "List files and directories in a directory.",
    args: {
      path: tool.schema
        .string()
        .optional()
        .describe("The directory to list. Defaults to the current working directory."),
    },
    execute: async (args: { path?: string }, context: ToolContext) => {
      const contextDir = context.directory || process.cwd()
      const listPath = args.path ? resolve(contextDir, args.path) : contextDir
      try {
        const entries = await fs.readdir(listPath, { withFileTypes: true })
        const result = entries
          .map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`)
          .join("\n")
        return result || "(Empty directory)"
      } catch (err: any) {
        return `Error listing directory: ${err.message}`
      }
    },
  })
}
