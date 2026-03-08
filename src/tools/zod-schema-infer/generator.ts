type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[]

export function inferZodSchema(input: string): string {
  try {
    const json = JSON.parse(input)
    return `import { z } from "zod"\n\nexport const schema = ${generateZod(json)}`
  } catch (e) {
    // If not JSON, try a very basic TS interface parser or just return error
    return `Error: Input must be valid JSON for now. TS interface parsing coming soon.\nDetails: ${e instanceof Error ? e.message : String(e)}`
  }
}

function generateZod(val: JsonValue, indent = ""): string {
  if (val === null) return "z.null()"
  if (typeof val === "string") return "z.string()"
  if (typeof val === "number") return "z.number()"
  if (typeof val === "boolean") return "z.boolean()"

  if (Array.isArray(val)) {
    if (val.length === 0) return "z.array(z.any())"
    const itemSchema = generateZod(val[0], indent)
    return `z.array(${itemSchema})`
  }

  const entries = Object.entries(val)
  if (entries.length === 0) return "z.object({})"

  let obj = "z.object({\n"
  const nextIndent = indent + "  "
  for (const [key, value] of entries) {
    obj += `${nextIndent}${key}: ${generateZod(value, nextIndent)},\n`
  }
  obj += `${indent}})`
  return obj
}
