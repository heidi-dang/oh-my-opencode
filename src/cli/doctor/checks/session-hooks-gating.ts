import picocolors from "picocolors"
import fs from "fs"
import path from "path"
import type { CheckDefinition, CheckResult, DoctorIssue } from "../types"

const FILE_PATH = path.join(__dirname, "../../../../src/plugin/hooks/create-session-hooks.ts")
const GATED_HOOKS = [
  "usage-patch",
  "run-state-watchdog",
  "sandbox-control",
  "critique-gate",
  "language-intelligence"
] as const

export const checkSessionHooksGating: CheckDefinition = {
  id: "session-hooks-gating",
  name: "Session Hooks Gating",
  critical: true,
  check: async (): Promise<CheckResult> => {
    const issues: DoctorIssue[] = []
    let hasError = false

    try {
      const content = fs.readFileSync(FILE_PATH, "utf8")
      for (const hook of GATED_HOOKS) {
        const pattern = `isHookEnabled("${hook}")`
        if (!content.includes(pattern)) {
          hasError = true
          issues.push({
            severity: "error",
            title: `Missing gate for ${hook} hook`,
            description: `create-session-hooks.ts does not gate ${hook} behind isHookEnabled("${hook}"). This causes always-on execution during session load, leading to refresh loops.`,
            fix: `Add: const ${hook} = isHookEnabled("${hook}") ? safeHook(...) : null`
          })
        }
      }
    } catch (error) {
      hasError = true
      issues.push({
        severity: "error",
        title: "Session hooks file not found",
        description: `Could not read ${FILE_PATH}`,
        fix: "Verify src/plugin/hooks/create-session-hooks.ts exists."
      })
    }

    if (hasError) {
      return {
        name: "Session Hooks Gating",
        status: "fail",
        message: picocolors.red("Session hooks not properly gated — risk of refresh loops."),
        issues
      }
    }

    return {
      name: "Session Hooks Gating",
      status: "pass",
      message: picocolors.green("All suspect session hooks gated behind isHookEnabled."),
      issues
    }
  }
}