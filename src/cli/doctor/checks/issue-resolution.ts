import pc from "picocolors"
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { CheckResult, DoctorIssue } from "../types"
import { DETERMINISTIC_TOOLS } from "../../../runtime/tools/registry"
import { getDataDir } from "../../../shared/data-path"

export const ISSUE_RESOLUTION_CHECK = {
  id: "ISSUE_RESOLUTION_WORKFLOW",
  title: "Issue Resolution Workflow",
  description: "Verifies the strict issue resolution workflow is intact and persistent",
}

export async function checkIssueResolutionWorkflow(): Promise<CheckResult> {
  const issues: DoctorIssue[] = []

  // 1. Tool Registration Check
  if (!DETERMINISTIC_TOOLS["report_issue_verification"]) {
    issues.push({
      severity: "error",
      title: "Missing Tool",
      description: "report_issue_verification tool is missing from deterministic registry",
      fix: "Ensure report_issue_verification is registered in src/runtime/tools/registry.ts",
    })
  }

  if (!DETERMINISTIC_TOOLS["complete_task"]) {
    issues.push({
      severity: "error",
      title: "Missing Tool",
      description: "complete_task tool is missing from deterministic registry",
      fix: "Ensure complete_task is registered in src/runtime/tools/registry.ts",
    })
  }

  // 2. Persistence Check
  try {
    const dataDir = join(getDataDir(), "oh-my-opencode")
    const testFile = join(dataDir, ".doctor-persistence-test")
    
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    
    writeFileSync(testFile, "test")
    unlinkSync(testFile)
  } catch (e: any) {
    issues.push({
      severity: "warning",
      title: "Persistence Issue",
      description: `Cannot write to OMO data directory: ${e.message}`,
      fix: "Check permissions for your local share directory",
    })
  }

  // 3. Implementation Logic Verification (Static check via Tool Definition)
  try {
    if (DETERMINISTIC_TOOLS["complete_task"]) {
      const tool = DETERMINISTIC_TOOLS["complete_task"]()
      // We can't easily verify the inner execute logic without running it,
      // but we can at least verify it's a valid tool object.
      if (!tool || typeof tool.execute !== "function") {
        issues.push({
          severity: "error",
          title: "Invalid Tool Implementation",
          description: "complete_task tool has missing or invalid execute function",
          fix: "Check src/runtime/tools/complete-task.ts",
        })
      }
    }
  } catch (e: any) {
    issues.push({
      severity: "error",
      title: "Tool Initialization Error",
      description: `Error initializing complete_task for check: ${e.message}`,
      fix: "Fix syntax or import errors in complete-task.ts",
    })
  }

  return {
    name: "Issue Resolution Workflow",
    message: issues.length === 0 ? "Workflow is intact and persistent" : "Workflow check found issues",
    status: issues.length === 0 ? "pass" : issues.some(i => i.severity === "error") ? "fail" : "warn",
    issues,
  }
}
