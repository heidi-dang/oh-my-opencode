
import { CHECK_IDS, CHECK_NAMES } from "../constants"
import type { CheckResult, DoctorIssue } from "../types"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

export async function checkMemoryRisk(): Promise<CheckResult> {
  const issues: DoctorIssue[] = []
  const details: string[] = []

  // Static Analysis: Search for unbounded Maps in core shared files
  const searchPatterns = [
    { pattern: "new Map<", label: "Unbounded Map" },
    { pattern: "new Set<", label: "Unbounded Set" },
    { pattern: "push\\(", label: "Unbounded Array" },
  ]

  // Focus on registries that should be pruned
  const riskyFiles = [
    "src/shared/session-category-registry.ts",
    "src/shared/token-usage-registry.ts",
    "src/features/claude-code-session-state/state.ts"
  ]

  for (const file of riskyFiles) {
    try {
      const fullPath = join(process.cwd(), file)
      const content = readFileSync(fullPath, "utf-8")
      
      if (content.includes("Map<") && !content.includes("delete(") && !content.includes("prune")) {
         issues.push({
           title: "Potential memory leak in registry",
           description: `File \`${file}\` uses a Map but lacks visible cleanup or pruning logic.`,
           fix: "Implement a pruning mechanism or use a TTL-based cache.",
           severity: "warning",
           affects: ["Memory stability"]
         })
      }
    } catch (e) {
      // Skip files that might not exist in some environments
    }
  }

  // Check for large tool output capture patterns
  const toolFiles = [
    "src/tools/grep/cli.ts",
    "src/tools/ast-grep/process-output-timeout.ts"
  ]

  for (const file of toolFiles) {
     try {
       const fullPath = join(process.cwd(), file)
       const content = readFileSync(fullPath, "utf-8")
       if (content.includes("Response(") && content.includes(".text()") && !content.includes("readStreamWithLimit")) {
          issues.push({
            title: "Unbounded tool output capture",
            description: `File \`${file}\` appears to consume full process output into memory without limits.`,
            fix: "Use `readStreamWithLimit` to cap captured output at the stream level.",
            severity: "error",
            affects: ["OOM resilience"]
          })
       }
     } catch (e) {}
  }

  return {
    name: CHECK_NAMES[CHECK_IDS.MEMORY_RISK],
    status: issues.length === 0 ? "pass" : issues.some(i => i.severity === "error") ? "fail" : "warn",
    message: issues.length === 0 ? "No critical memory risks detected" : `${issues.length} memory risks detected`,
    details,
    issues
  }
}
