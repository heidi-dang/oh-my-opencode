import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { inferZodSchema } from "./generator"

export function createZodSchemaInfer(): ToolDefinition {
  return tool({
    description: "Infers a Zod schema from a JSON string.",
    args: {
      json: tool.schema.string().describe("The JSON string to infer a Zod schema from"),
    },
    execute: async (args) => {
      return inferZodSchema(args.json)
    },
  })
}
