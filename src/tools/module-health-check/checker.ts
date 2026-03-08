import { exec } from "node:child_process"
import { promisify } from "node:util"
import { join, relative } from "node:path"
import { readFileSync, readdirSync, statSync } from "node:fs"

const execAsync = promisify(exec)

export interface HealthIssue {
  file: string
  rule: string
  severity: "error" | "warning"
  message: string
}

export async function checkModuleHealth(path: string, directory: string): Promise<HealthIssue[]> {
  const fullPath = join(directory, path)
  const issues: HealthIssue[] = []
  
  const files = getAllFiles(fullPath).filter(f => f.endsWith(".ts") || f.endsWith(".tsx"))

  for (const file of files) {
    const relFile = relative(directory, file)
    const content = readFileSync(file, "utf-8")
    const lines = content.split("\n")

    // Rule: Files under 200 LOC
    if (lines.length > 200) {
      issues.push({
        file: relFile,
        rule: "LOC_LIMIT",
        severity: "warning",
        message: `File is ${lines.length} lines, exceeding the 200 line soft limit.`
      })
    }

    // Rule: No utils.ts, helpers.ts, service.ts
    const basename = file.split("/").pop() || ""
    if (["utils.ts", "helpers.ts", "service.ts"].includes(basename)) {
      issues.push({
        file: relFile,
        rule: "BANNED_FILENAME",
        severity: "error",
        message: `Banned filename: ${basename}. Use descriptive domain-specific names.`
      })
    }

    // Rule: No as any, @ts-ignore
    if (content.includes("as any")) {
      issues.push({
        file: relFile,
        rule: "NO_AS_ANY",
        severity: "error",
        message: "Found 'as any'. Use proper typing."
      })
    }
    if (content.includes("@ts-ignore") || content.includes("@ts-expect-error")) {
      issues.push({
        file: relFile,
        rule: "NO_SUPPRESSION",
        severity: "error",
        message: "Found '@ts-ignore' or '@ts-expect-error'. Fix the underlying type issue."
      })
    }
  }

  return issues
}

function getAllFiles(dir: string): string[] {
  let results: string[] = []
  const list = readdirSync(dir)
  list.forEach(file => {
    file = join(dir, file)
    const stat = statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(file))
    } else {
      results.push(file)
    }
  })
  return results
}
