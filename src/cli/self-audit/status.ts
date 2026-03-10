import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { AuditFunction } from "./types"

const ROOT_DIR = process.cwd()
const DOCS_DIR = join(ROOT_DIR, "docs", "self-audit")

export async function showStatus(json: boolean): Promise<number> {
  try {
    const indexPath = join(DOCS_DIR, "index.txt")
    const progressPath = join(DOCS_DIR, "progress.txt")
    
    let indexContent: string
    let progressContent: string
    
    try {
      indexContent = await readFile(indexPath, "utf-8")
    } catch {
      console.log("No audit inventory found. Run 'oh-my-opencode self-audit inventory' first.")
      return 1
    }
    
    try {
      progressContent = await readFile(progressPath, "utf-8")
    } catch {
      progressContent = "No progress log found."
    }
    
    if (json) {
      const status = parseStatusFromIndex(indexContent)
      console.log(JSON.stringify(status, null, 2))
    } else {
      console.log("=== Self-Audit Status ===\n")
      console.log(indexContent)
      console.log("\n=== Progress Log ===\n")
      console.log(progressContent)
    }
    
    return 0
    
  } catch (error) {
    console.error("Error reading audit status:", error)
    return 1
  }
}

function parseStatusFromIndex(content: string): any {
  const lines = content.split("\n")
  const status: any = {}
  
  for (const line of lines) {
    if (line.startsWith("Total function count:")) {
      status.total = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("Completed count:")) {
      status.completed = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("Fixed count:")) {
      status.fixed = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("Improved count:")) {
      status.improved = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("No-change pass count:")) {
      status.noChange = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("Blocked count:")) {
      status.blocked = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("Remaining count:")) {
      status.remaining = parseInt(line.split(":").pop() || "0")
    } else if (line.startsWith("Percent complete:")) {
      status.percentComplete = parseInt(line.split(":").pop()?.replace("%", "") || "0")
    } else if (line.startsWith("Last processed function:")) {
      status.lastProcessed = line.split(":").pop()?.trim() || "none"
    } else if (line.startsWith("Latest commit SHA:")) {
      status.latestCommitSha = line.split(":").pop()?.trim() || "unknown"
    }
  }
  
  // Parse function inventory
  const functions: AuditFunction[] = []
  let inInventory = false
  
  for (const line of lines) {
    if (line === "## Function Inventory") {
      inInventory = true
      continue
    }
    
    if (inInventory && line.includes("::") && !line.startsWith("#") && line.trim()) {
      const [status, id, reportPath] = line.split("\t")
      functions.push({
        id,
        filePath: "",
        functionName: "",
        language: "",
        category: "runtime",
        status: status as any,
        reportPath: reportPath !== "no-report" ? reportPath : undefined
      })
    }
  }
  
  status.functions = functions
  return status
}
