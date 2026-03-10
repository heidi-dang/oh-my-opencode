import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { execSync } from "node:child_process"
import type { AuditFunction, AuditReport } from "./types"

const ROOT_DIR = process.cwd()
const DOCS_DIR = join(ROOT_DIR, "docs", "self-audit")

export async function updateIndex(functions: AuditFunction[]): Promise<void> {
  const indexPath = join(DOCS_DIR, "index.txt")
  
  const stats = {
    total: functions.length,
    completed: functions.filter(f => f.status !== "pending" && f.status !== "in_progress").length,
    fixed: functions.filter(f => f.status === "fixed" || f.status === "fixed+improved").length,
    improved: functions.filter(f => f.status === "improved" || f.status === "fixed+improved").length,
    noChange: functions.filter(f => f.status === "pass-no-change").length,
    blocked: functions.filter(f => f.status === "blocked").length,
    remaining: functions.filter(f => f.status === "pending" || f.status === "in_progress").length
  }
  
  const lastProcessed = functions
    .filter(f => f.status !== "pending" && f.status !== "in_progress")
    .pop()
  
  const latestCommit = getCurrentCommitSha()
  const percentComplete = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  
  const content = [
    `# Self-Audit Function Inventory`,
    `Generated: ${new Date().toISOString()}`,
    `Commit SHA: ${latestCommit}`,
    ``,
    `## Summary`,
    `Total function count: ${stats.total}`,
    `Completed count: ${stats.completed}`,
    `Fixed count: ${stats.fixed}`,
    `Improved count: ${stats.improved}`,
    `No-change pass count: ${stats.noChange}`,
    `Blocked count: ${stats.blocked}`,
    `Remaining count: ${stats.remaining}`,
    `Percent complete: ${percentComplete}%`,
    `Last processed function: ${lastProcessed?.id || "none"}`,
    `Latest commit SHA: ${latestCommit}`,
    ``,
    `## Function Inventory`,
    ...functions.map(func => 
      `${func.status}\t${func.id}\t${func.reportPath || "no-report"}`
    )
  ].join("\n")
  
  await writeFile(indexPath, content)
}

export async function updateProgress(report: AuditReport): Promise<void> {
  const progressPath = join(DOCS_DIR, "progress.txt")
  
  try {
    const existingContent = await readFile(progressPath, "utf-8")
    
    const newEntry = [
      ``,
      `## Iteration ${new Date().toISOString()}`,
      `Function: ${report.functionId}`,
      `Status: ${report.finalStatus}`,
      `Changes: ${Object.keys(report.changes).filter(key => report.changes[key as keyof typeof report.changes]).join(", ") || "None"}`,
      `Tests run: ${report.verification.testsRun.join(", ")}`,
      `Commit: ${report.commitShaAfter || "No change"}`,
      `Files changed: ${report.filesChanged.join(", ") || "None"}`
    ].join("\n")
    
    const updatedContent = existingContent + newEntry
    await writeFile(progressPath, updatedContent)
    
  } catch {
    // File doesn't exist, create it
    const content = [
      `# Self-Audit Progress Log`,
      `Started: ${new Date().toISOString()}`,
      `Commit SHA: ${getCurrentCommitSha()}`,
      ``,
      `## Audit Iterations`,
      `Iteration ${new Date().toISOString()}`,
      `Function: ${report.functionId}`,
      `Status: ${report.finalStatus}`,
      `Changes: ${Object.keys(report.changes).filter(key => report.changes[key as keyof typeof report.changes]).join(", ") || "None"}`,
      `Tests run: ${report.verification.testsRun.join(", ")}`,
      `Commit: ${report.commitShaAfter || "No change"}`,
      `Files changed: ${report.filesChanged.join(", ") || "None"}`
    ].join("\n")
    
    await writeFile(progressPath, content)
  }
}

function getCurrentCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: ROOT_DIR }).trim()
  } catch {
    return "unknown"
  }
}
