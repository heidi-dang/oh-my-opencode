import pc from "picocolors"
import { CheckResult, DoctorIssue } from "../types"
import { DETERMINISTIC_TOOLS } from "../../../runtime/tools/registry"

export const ISSUE_RESOLUTION_CHECK = {
  id: "ISSUE_RESOLUTION_WORKFLOW",
  title: "Issue Resolution Workflow",
  description: "Verifies the strict issue resolution workflow is intact",
}

export async function checkIssueResolutionWorkflow(): Promise<CheckResult> {
  const issues: DoctorIssue[] = []

  // Check if report_issue_verification is registered
  if (!DETERMINISTIC_TOOLS["report_issue_verification"]) {
    issues.push({
      severity: "error",
      title: "Missing Tool",
      description: "report_issue_verification tool is missing from deterministic registry",
      fix: "Ensure report_issue_verification is exported and registered in src/runtime/tools/registry.ts",
    })
  } else {
    try {
      const tool = DETERMINISTIC_TOOLS["report_issue_verification"]()
      if (!tool || tool.name !== "report_issue_verification") {
        issues.push({
          severity: "error",
          title: "Invalid Tool",
          description: `report_issue_verification tool builder returned invalid tool`,
          fix: "Check the implementation of createReportIssueVerificationTool",
        })
      }
    } catch (e: any) {
      issues.push({
        severity: "error",
        title: "Tool Builder Error",
        description: `report_issue_verification tool builder threw an error: ${e.message}`,
        fix: "Check the implementation of createReportIssueVerificationTool",
      })
    }
  }

  // Check if complete_task is registered
  if (!DETERMINISTIC_TOOLS["complete_task"]) {
    issues.push({
      severity: "error",
      title: "Missing Tool",
      description: "complete_task tool is missing from deterministic registry",
      fix: "Ensure complete_task is exported and registered in src/runtime/tools/registry.ts",
    })
  }

  return {
    name: "Issue Resolution Workflow",
    message: issues.length === 0 ? "Workflow is intact" : "Workflow check failed",
    status: issues.length === 0 ? "pass" : "fail",
    issues,
  }
}
