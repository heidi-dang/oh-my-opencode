import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { generateMermaidUrl } from "./converter"

export function createMermaidToImage(): ToolDefinition {
  return tool({
    description: "Converts Mermaid diagram code into a publicly viewable image URL using Mermaid.ink.",
    args: {
      mermaid: tool.schema.string().describe("The Mermaid diagram code to convert"),
    },
    execute: async (args) => {
      try {
        const url = generateMermaidUrl(args.mermaid)
        return `### Mermaid Diagram generated!\n\n![Mermaid Diagram](${url})\n\n[Open in browser](${url})`
      } catch (error) {
        return `Error converting Mermaid to image: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
