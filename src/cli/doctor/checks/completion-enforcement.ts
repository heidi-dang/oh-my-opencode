import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CheckResult, DoctorIssue } from "../types"

export const COMPLETION_STATE_ENFORCEMENT_CHECK = {
  id: "COMPLETION_STATE_ENFORCEMENT",
  title: "Completion State Enforcement",
  description: "Verifies that task completion is fail-closed and cannot be bypassed",
}

export async function checkCompletionStateEnforcement(): Promise<CheckResult> {
  const issues: DoctorIssue[] = []
  const sourceDir = process.cwd()

  // 1. Check that verify-task-completion.ts has fail-closed behavior
  try {
    const verifyTaskPath = join(sourceDir, "src/shared/verify-task-completion.ts")
    const content = readFileSync(verifyTaskPath, "utf-8")

    // Check for the fail-closed pattern (return false on error)
    const hasFailClosed = content.includes("return false") && 
      (content.includes("catch (error)") || content.includes("catch(error)"))

    if (!hasFailClosed) {
      issues.push({
        severity: "error",
        title: "Missing Fail-Closed Exception Handling",
        description: "verify-task-completion.ts must have fail-closed exception handling (return false on error)",
        fix: "Update verify-task-completion.ts catch block to return false instead of true",
      })
    }

    // Check that it doesn't have the old fail-open pattern
    const hasFailOpen = /catch[^{]*\{[^}]*return true/.test(content)
    if (hasFailOpen) {
      issues.push({
        severity: "error",
        title: "Fail-Open Bug Still Present",
        description: "verify-task-completion.ts still has fail-open exception handling (returns true on error)",
        fix: "Change catch block to return false",
      })
    }
  } catch (e: any) {
    issues.push({
      severity: "error",
      title: "Cannot Read verify-task-completion.ts",
      description: `Error reading file: ${e.message}`,
      fix: "Ensure src/shared/verify-task-completion.ts exists",
    })
  }

  // 2. Check that completion-gate.ts exists
  try {
    const completionGatePath = join(sourceDir, "src/shared/completion-gate.ts")
    const gateContent = readFileSync(completionGatePath, "utf-8")

    // Verify it exports the key functions
    if (!gateContent.includes("export function isStopActive")) {
      issues.push({
        severity: "error",
        title: "Missing isStopActive Function",
        description: "completion-gate.ts must export isStopActive function",
        fix: "Add isStopActive function to src/shared/completion-gate.ts",
      })
    }

    if (!gateContent.includes("export function canCompleteWithIssueState")) {
      issues.push({
        severity: "error",
        title: "Missing canCompleteWithIssueState Function",
        description: "completion-gate.ts must export canCompleteWithIssueState function",
        fix: "Add canCompleteWithIssueState function to src/shared/completion-gate.ts",
      })
    }
  } catch (e: any) {
    issues.push({
      severity: "error",
      title: "Missing completion-gate.ts",
      description: `File not found: ${e.message}`,
      fix: "Create src/shared/completion-gate.ts with authoritative completion gate functions",
    })
  }

  // 3. Check that completion.ts has stop check
  try {
    const completionPath = join(sourceDir, "src/cli/run/completion.ts")
    const completionContent = readFileSync(completionPath, "utf-8")

    if (!completionContent.includes("isStopActive")) {
      issues.push({
        severity: "error",
        title: "Missing Stop Check in completion.ts",
        description: "completion.ts must check isStopActive before allowing completion",
        fix: "Add isStopActive check to checkCompletionConditions in src/cli/run/completion.ts",
      })
    }
  } catch (e: any) {
    issues.push({
      severity: "error",
      title: "Cannot Read completion.ts",
      description: `Error reading file: ${e.message}`,
      fix: "Ensure src/cli/run/completion.ts exists",
    })
  }

  // 4. Check for implementation documentation
  try {
    const docPath = join(sourceDir, "docs/implementation-completion-state-enforcement.md")
    const docContent = readFileSync(docPath, "utf-8")

    if (!docContent.includes("Bug Summary") || !docContent.includes("Root Cause")) {
      issues.push({
        severity: "warning",
        title: "Incomplete Implementation Documentation",
        description: "Documentation must include bug summary and root cause analysis",
        fix: "Update docs/implementation-completion-state-enforcement.md with complete information",
      })
    }
  } catch (e: any) {
    issues.push({
      severity: "warning",
      title: "Missing Implementation Documentation",
      description: "docs/implementation-completion-state-enforcement.md not found",
      fix: "Create implementation documentation for completion state enforcement",
    })
  }

  return {
    name: "Completion State Enforcement",
    message: issues.length === 0 
      ? "All completion enforcement checks passed" 
      : `Found ${issues.length} issue(s)`,
    status: issues.length === 0 
      ? "pass" 
      : issues.some(i => i.severity === "error") 
        ? "fail" 
        : "warn",
    issues,
  }
}
