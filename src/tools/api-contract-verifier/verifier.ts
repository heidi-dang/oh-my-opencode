import { readFileSync } from "node:fs"
import { join } from "node:path"

export interface ContractIssue {
  rule: string
  severity: "error" | "warning"
  message: string
}

export function verifyApiContract(file: string, directory: string): ContractIssue[] {
  const fullPath = join(directory, file)
  const content = readFileSync(fullPath, "utf-8")
  const issues: ContractIssue[] = []

  // Check for common hook patterns
  if (file.includes("hooks/")) {
    if (!content.includes("export function create") && !content.includes("export const create")) {
      issues.push({
        rule: "MISSING_FACTORY",
        severity: "error",
        message: "Hook file missing 'createXXX' factory function. Our architecture requires factory-based hook registration."
      })
    }
  }

  // Check for tool patterns
  if (file.includes("tools/")) {
    if (!content.includes("import { tool") && !content.includes("@opencode-ai/plugin/tool")) {
      issues.push({
        rule: "INVALID_TOOL_IMPORT",
        severity: "warning",
        message: "Tool file might be using legacy tool definition. Use '@opencode-ai/plugin/tool' for better type safety."
      })
    }
  }

  return issues
}
