import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

import { DEFAULT_MAX_DIAGNOSTICS } from "./constants"
import { filterDiagnosticsBySeverity, formatDiagnostic } from "./lsp-formatters"
import { withLspClient, LspNotConfiguredError } from "./lsp-client-wrapper"
import type { Diagnostic } from "./types"

export const lsp_diagnostics: ToolDefinition = tool({
  description: "Get errors, warnings, hints from language server BEFORE running build.",
  args: {
    filePath: tool.schema.string(),
    severity: tool.schema
      .enum(["error", "warning", "information", "hint", "all"])
      .optional()
      .describe("Filter by severity level"),
  },
  execute: async (args, _context) => {
    try {
      const result = await withLspClient(args.filePath, async (client) => {
        return (await client.diagnostics(args.filePath)) as { items?: Diagnostic[] } | Diagnostic[] | null
      })

      let diagnostics: Diagnostic[] = []
      if (result) {
        if (Array.isArray(result)) {
          diagnostics = result
        } else if (result.items) {
          diagnostics = result.items
        }
      }

      diagnostics = filterDiagnosticsBySeverity(diagnostics, args.severity)

      if (diagnostics.length === 0) {
        const output = "No diagnostics found"
        return output
      }

      const total = diagnostics.length
      const truncated = total > DEFAULT_MAX_DIAGNOSTICS
      const limited = truncated ? diagnostics.slice(0, DEFAULT_MAX_DIAGNOSTICS) : diagnostics
      const lines = limited.map(formatDiagnostic)
      if (truncated) {
        lines.unshift(`Found ${total} diagnostics (showing first ${DEFAULT_MAX_DIAGNOSTICS}):`)
      }
      const output = lines.join("\n")
      return output
    } catch (e) {
      if (e instanceof LspNotConfiguredError) {
        const isCommonType = args.filePath.endsWith(".json") || args.filePath.endsWith(".txt") || args.filePath.endsWith(".md")
        return isCommonType
          ? `LSP Diagnostics not available for ${args.filePath.split('.').pop()} files. Skipping diagnostics check.`
          : "Error: LSP not configured for this file type."
      }
      const output = `Error: ${e instanceof Error ? e.message : String(e)}`
      throw new Error(output)
    }
  },
})
