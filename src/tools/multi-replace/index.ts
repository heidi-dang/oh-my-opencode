import * as fs from "fs"
import * as path from "path"
import { tool, type ToolDefinition, type ToolContext } from "@opencode-ai/plugin/tool"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { withToolContract } from "../../utils/tool-contract-wrapper"

interface ReplacementChunk {
  target: string
  replacement: string
}

interface MultiReplaceArgs {
  filePath: string
  chunks: ReplacementChunk[]
}

export function createMultiReplaceTool(): ToolDefinition {
  return tool({
    description: "Apply multiple non-contiguous search-and-replace edits to a file in a single atomic operation. Ensures all target strings are present before applying any changes.",
    args: {
      filePath: tool.schema.string().describe("Absolute or relative path to the file to edit"),
      chunks: tool.schema.array(
        tool.schema.object({
          target: tool.schema.string().describe("The exact text to find and replace"),
          replacement: tool.schema.string().describe("The replacement text")
        })
      ).describe("Array of search-and-replace chunks")
    },
    execute: withToolContract("multi_replace_file_content", async (args: MultiReplaceArgs, context: ToolContext) => {
      try {
        const { filePath, chunks } = args
        const contextDir = context.directory || process.cwd()
        const fullPath = path.resolve(contextDir, filePath)

        // 🚨 SECURITY: Repo Boundary & Symlink Guard (Reusing fs_safe logic)
        if (!fullPath.startsWith(contextDir)) {
          throw new Error(`Security Violation: Path escapes repository boundary (${filePath})`)
        }

        const relativePath = path.relative(contextDir, fullPath)
        const parts = relativePath.split(path.sep)
        let currentPath = contextDir
        for (const part of parts) {
          if (!part || part === ".") continue
          currentPath = path.join(currentPath, part)
          try {
            const stats = fs.lstatSync(currentPath)
            if (stats.isSymbolicLink()) {
              throw new Error(`Security Violation: Symlink detected at '${part}'. Symlinks are forbidden to prevent repo escape.`)
            }
          } catch (e: any) {
            if (e.code !== "ENOENT") throw e
            break
          }
        }

        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        let content = fs.readFileSync(fullPath, "utf8")
        
        // Phase 1: Verification
        for (const chunk of chunks) {
          if (!content.includes(chunk.target)) {
            throw new Error(`Target content not found in file: ${chunk.target.substring(0, 50)}${chunk.target.length > 50 ? '...' : ''}`)
          }
          // Ensure target is unique to avoid ambiguity
          const instances = content.split(chunk.target).length - 1
          if (instances > 1) {
            throw new Error(`Multiple instances of target content found. Please provide more context to make it unique: ${chunk.target.substring(0, 50)}...`)
          }
        }

        // Phase 2: Application
        let newContent = content
        for (const chunk of chunks) {
          newContent = newContent.replace(chunk.target, chunk.replacement)
        }

        fs.writeFileSync(fullPath, newContent, "utf8")

        const result = createSuccessResult({
          verified: true,
          changedState: true,
          stateChange: { type: "file.write", key: filePath, details: { fullPath, chunkCount: chunks.length } }
        })

        context.metadata({
          title: "Multi-Replace applied",
          ...result
        })

        return `Successfully applied ${chunks.length} replacement(s) to ${filePath}.`
      } catch (err: any) {
        const result = createFailureResult(`Failed: ${err.message}`)
        context.metadata({
          title: "Multi-Replace error",
          ...result
        })
        return result.message || `Error: ${err.message}`
      }
    })
  })
}
