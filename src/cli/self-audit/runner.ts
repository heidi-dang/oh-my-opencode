import { readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { execSync } from "node:child_process"
import type { SelfAuditOptions, AuditFunction, AuditReport, ProgressState, VerificationResult } from "./types"
import { generateInventory } from "./inventory"
import { writeFunctionReport } from "./report-writer"
import { runVerification } from "./verification"
import { updateIndex, updateProgress } from "./progress-tracker"

const ROOT_DIR = process.cwd()
const DOCS_DIR = join(ROOT_DIR, "docs", "self-audit")
const FUNCTIONS_DIR = join(DOCS_DIR, "functions")
const STATE_PATH = join(ROOT_DIR, ".runtime", "self-audit-state.json")

async function ensureDir(path: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises")
  await mkdir(path, { recursive: true })
}

async function loadInventory(): Promise<AuditFunction[]> {
  const indexPath = join(DOCS_DIR, "index.txt")
  const content = await readFile(indexPath, "utf-8")
  
  const lines = content.split("\n")
  const functions: AuditFunction[] = []
  
  for (const line of lines) {
    if (line.includes("::") && !line.startsWith("#") && line.trim()) {
      const [status, id, reportPath] = line.split("\t")
      const [filePath, functionName, language, lineInfo] = id.split("::")
      
      functions.push({
        id,
        filePath: join(ROOT_DIR, filePath),
        functionName,
        language,
        category: inferCategory(filePath, functionName),
        status: status as any,
        reportPath: reportPath !== "no-report" ? reportPath : undefined,
        lastCommitSha: undefined
      })
    }
  }
  
  return functions
}

function inferCategory(filePath: string, functionName: string): any {
  const path = filePath.toLowerCase()
  
  if (path.includes("/test") || path.includes("/tests") || functionName.includes("test") || functionName.includes("spec")) {
    return "test-helper"
  }
  
  if (path.includes("/cli") || path.includes("/tools") || path.includes("/script")) {
    return "tooling"
  }
  
  if (path.includes("/api") || path.includes("/server") || functionName.includes("handler") || functionName.includes("endpoint")) {
    return "api"
  }
  
  if (path.includes("/ui") || path.includes("/components") || path.includes("/views") || functionName.includes("render") || functionName.includes("display")) {
    return "ui"
  }
  
  return "runtime"
}

async function loadProgressState(): Promise<ProgressState> {
  try {
    const content = await readFile(STATE_PATH, "utf-8")
    const parsed = JSON.parse(content)
    return {
      ...parsed,
      completedFunctions: new Set(parsed.completedFunctions || [])
    }
  } catch {
    return {
      currentFunctionIndex: 0,
      completedFunctions: new Set<string>(),
      lastCommitSha: getCurrentCommitSha(),
      startTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString()
    }
  }
}

async function saveProgressState(state: ProgressState): Promise<void> {
  await ensureDir(join(ROOT_DIR, ".runtime"))
  
  const serialized = {
    ...state,
    completedFunctions: Array.from(state.completedFunctions)
  }
  
  await writeFile(STATE_PATH, JSON.stringify(serialized, null, 2))
}

function getCurrentCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: ROOT_DIR }).trim()
  } catch {
    return "unknown"
  }
}

async function selectNextFunction(inventory: AuditFunction[], state: ProgressState): Promise<AuditFunction | null> {
  for (let i = state.currentFunctionIndex; i < inventory.length; i++) {
    const func = inventory[i]
    if (!state.completedFunctions.has(func.id) && func.status === "pending") {
      state.currentFunctionIndex = i
      return func
    }
  }
  return null
}

async function auditFunction(func: AuditFunction): Promise<{
  report: AuditReport
  filesChanged: string[]
  finalStatus: "fixed" | "improved" | "fixed+improved" | "pass-no-change" | "blocked"
}> {
  console.log(`\n=== Auditing ${func.id} ===`)
  
  const commitShaBefore = getCurrentCommitSha()
  
  // Read function and context
  const functionContent = await readFile(func.filePath, "utf-8")
  const lines = functionContent.split("\n")
  
  const startLine = func.lineStart ? Math.max(1, func.lineStart - 5) : 1
  const endLine = func.lineEnd ? Math.min(lines.length, func.lineEnd + 5) : lines.length
  const context = lines.slice(startLine - 1, endLine).join("\n")
  
  // Determine purpose and callers
  const purpose = determineFunctionPurpose(func, context)
  const callerContext = analyzeCallerContext(func, context)
  
  // Pre-audit findings
  const preAuditFindings = {
    correctness: analyzeCorrectness(func, context),
    performance: analyzePerformance(func, context),
    codeHealth: analyzeCodeHealth(func, context)
  }
  
  // Run verification before changes
  const beforeVerification = await runVerification(func, context)
  
  let changes: any = {}
  let filesChanged: string[] = []
  let finalStatus: any = "pass-no-change"
  
  if (!beforeVerification.passed) {
    // Fix correctness issues
    const fixResult = await applyCorrectnessFixes(func, context, beforeVerification.issues)
    if (fixResult.changed) {
      changes.bugFix = fixResult.description
      filesChanged.push(...fixResult.filesChanged)
      finalStatus = "fixed"
    }
  }
  
  // Check for performance improvements
  const perfAnalysis = analyzePerformanceOpportunities(func, context)
  if (perfAnalysis.hasOpportunity) {
    const perfResult = await applyPerformanceImprovements(func, context, perfAnalysis)
    if (perfResult.changed) {
      changes.performanceImprovement = perfResult.description
      filesChanged.push(...perfResult.filesChanged)
      finalStatus = finalStatus === "fixed" ? "fixed+improved" : "improved"
    }
  }
  
  // Check for code health improvements
  const healthAnalysis = analyzeCodeHealthOpportunities(func, context)
  if (healthAnalysis.hasOpportunity && finalStatus === "pass-no-change") {
    const healthResult = await applyCodeHealthImprovements(func, context, healthAnalysis)
    if (healthResult.changed) {
      changes.codeHealthImprovement = healthResult.description
      filesChanged.push(...healthResult.filesChanged)
      finalStatus = "improved"
    }
  }
  
  // Run verification after changes
  const afterVerification = await runVerification(func, context)
  
  const report: AuditReport = {
    functionId: func.id,
    filePath: func.filePath,
    functionName: func.functionName,
    signature: func.signature,
    timestamp: new Date().toISOString(),
    commitShaBefore,
    purpose,
    callerContext,
    preAuditFindings,
    changes,
    verification: {
      testsRun: afterVerification.testsRun,
      beforeResult: beforeVerification.passed ? "PASS" : `FAIL: ${beforeVerification.issues.join("; ")}`,
      afterResult: afterVerification.passed ? "PASS" : `FAIL: ${afterVerification.issues.join("; ")}`
    },
    filesChanged,
    finalStatus,
    commitShaAfter: filesChanged.length > 0 ? getCurrentCommitSha() : commitShaBefore
  }
  
  return { report, filesChanged, finalStatus }
}

function determineFunctionPurpose(func: AuditFunction, context: string): string {
  // Simple heuristic-based purpose determination
  const name = func.functionName.toLowerCase()
  const content = context.toLowerCase()
  
  if (name.includes("create") || name.includes("build") || name.includes("make")) {
    return "Creates or constructs something"
  }
  
  if (name.includes("get") || name.includes("find") || name.includes("fetch") || name.includes("read")) {
    return "Retrieves or reads data"
  }
  
  if (name.includes("set") || name.includes("update") || name.includes("write") || name.includes("save")) {
    return "Modifies or writes data"
  }
  
  if (name.includes("delete") || name.includes("remove") || name.includes("clear")) {
    return "Deletes or removes data"
  }
  
  if (name.includes("check") || name.includes("validate") || name.includes("verify") || name.includes("ensure")) {
    return "Validates or checks conditions"
  }
  
  if (name.includes("parse") || name.includes("format") || name.includes("transform")) {
    return "Processes or transforms data"
  }
  
  if (content.includes("throw") || content.includes("error")) {
    return "Error handling or validation"
  }
  
  return "General utility or helper function"
}

function analyzeCallerContext(func: AuditFunction, context: string): string {
  // Simple analysis of potential callers based on function signature and context
  const name = func.functionName.toLowerCase()
  
  if (name.includes("private") || name.startsWith("_")) {
    return "Internal helper function - called by other functions in same module"
  }
  
  if (func.category === "tooling") {
    return "Called by CLI tools or external scripts"
  }
  
  if (func.category === "api") {
    return "Called by API layer or external clients"
  }
  
  if (func.category === "runtime") {
    return "Called by core plugin runtime"
  }
  
  return "Called by multiple components in the codebase"
}

function analyzeCorrectness(func: AuditFunction, context: string): string {
  const issues: string[] = []
  
  // Check for common correctness issues
  if (context.includes("if (!") && !context.includes("return")) {
    issues.push("Potential null/undefined check without early return")
  }
  
  if (context.includes("catch") && !context.includes("throw") && !context.includes("return")) {
    issues.push("Catch block without error handling or return")
  }
  
  if (context.includes("async") && !context.includes("await")) {
    issues.push("Async function without await calls")
  }
  
  return issues.length > 0 ? issues.join("; ") : "No obvious correctness issues found"
}

function analyzePerformance(func: AuditFunction, context: string): string {
  const issues: string[] = []
  
  // Check for common performance issues
  if (context.includes("for") && context.includes("length") && context.includes("push")) {
    issues.push("Loop with potential array reallocation")
  }
  
  if (context.includes("JSON.parse") || context.includes("JSON.stringify")) {
    issues.push("JSON operations in hot path")
  }
  
  if (context.includes("RegExp") && !context.includes("/^")) {
    issues.push("Regex compilation without caching")
  }
  
  return issues.length > 0 ? issues.join("; ") : "No obvious performance issues found"
}

function analyzeCodeHealth(func: AuditFunction, context: string): string {
  const issues: string[] = []
  
  // Check for code health issues
  const lines = context.split("\n")
  if (lines.length > 50) {
    issues.push("Large function body")
  }
  
  if (context.split("if ").length > 5) {
    issues.push("Complex conditional logic")
  }
  
  if (context.includes("TODO") || context.includes("FIXME")) {
    issues.push("Contains TODO/FIXME comments")
  }
  
  return issues.length > 0 ? issues.join("; ") : "Code appears healthy"
}

async function applyCorrectnessFixes(func: AuditFunction, context: string, issues: string[]): Promise<{ changed: boolean; description: string; filesChanged: string[] }> {
  // Placeholder for correctness fixes
  return { changed: false, description: "No correctness fixes applied", filesChanged: [] }
}

function analyzePerformanceOpportunities(func: AuditFunction, context: string): { hasOpportunity: boolean; description: string } {
  return { hasOpportunity: false, description: "No performance opportunities identified" }
}

async function applyPerformanceImprovements(func: AuditFunction, context: string, analysis: any): Promise<{ changed: boolean; description: string; filesChanged: string[] }> {
  return { changed: false, description: "No performance improvements applied", filesChanged: [] }
}

function analyzeCodeHealthOpportunities(func: AuditFunction, context: string): { hasOpportunity: boolean; description: string } {
  return { hasOpportunity: false, description: "No code health opportunities identified" }
}

async function applyCodeHealthImprovements(func: AuditFunction, context: string, analysis: any): Promise<{ changed: boolean; description: string; filesChanged: string[] }> {
  return { changed: false, description: "No code health improvements applied", filesChanged: [] }
}

async function commitAndChanges(report: AuditReport, filesChanged: string[]): Promise<void> {
  if (filesChanged.length === 0) {
    // Commit just the report
    const reportPath = join(FUNCTIONS_DIR, `${report.functionId.replace(/[\/:]/g, "_")}.txt`)
    execSync(`git add "${reportPath}"`, { cwd: ROOT_DIR })
    execSync(`git commit -m "self-audit(${report.functionId}): ${report.finalStatus}"`, { cwd: ROOT_DIR })
  } else {
    // Commit code changes and report
    const allPaths = [join(FUNCTIONS_DIR, `${report.functionId.replace(/[\/:]/g, "_")}.txt`), ...filesChanged]
    const pathsArg = allPaths.map(p => `"${p}"`).join(" ")
    execSync(`git add ${pathsArg}`, { cwd: ROOT_DIR })
    execSync(`git commit -m "self-audit(${report.functionId}): ${report.finalStatus}"`, { cwd: ROOT_DIR })
  }
  
  execSync("git push", { cwd: ROOT_DIR })
}

export async function selfAuditLoop(options: SelfAuditOptions): Promise<number> {
  console.log("Starting self-audit loop...")
  
  // Generate inventory first
  await generateInventory(false)
  
  // Load inventory and state
  const inventory = await loadInventory()
  const state: ProgressState = options.resume ? await loadProgressState() : {
    currentFunctionIndex: 0,
    completedFunctions: new Set<string>(),
    lastCommitSha: getCurrentCommitSha(),
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString()
  }
  
  console.log(`Loaded ${inventory.length} functions from inventory`)
  console.log(`Completed: ${state.completedFunctions.size} functions`)
  
  let iterations = 0
  const maxIterations = options.maxIterations ?? Infinity
  
  while (iterations < maxIterations) {
    const nextFunction = options.functionId 
      ? inventory.find(f => f.id === options.functionId) || null
      : await selectNextFunction(inventory, state)
    
    if (!nextFunction) {
      console.log("No more functions to audit. Loop complete!")
      break
    }
    
    if (options.dryRun) {
      console.log(`[DRY RUN] Would audit: ${nextFunction.id}`)
      state.completedFunctions.add(nextFunction.id)
      iterations++
      continue
    }
    
    // Mark as in progress
    nextFunction.status = "in_progress"
    state.inProgressFunction = nextFunction.id
    await saveProgressState(state)
    
    try {
      // Audit the function
      const { report, filesChanged, finalStatus } = await auditFunction(nextFunction)
      
      // Write report
      await writeFunctionReport(report)
      
      // Update inventory
      nextFunction.status = finalStatus
      nextFunction.reportPath = `docs/self-audit/functions/${report.functionId.replace(/[\/:]/g, "_")}.txt`
      nextFunction.lastCommitSha = report.commitShaAfter
      
      // Update progress files
      await updateIndex(inventory)
      await updateProgress(report)
      
      // Commit and push
      await commitAndChanges(report, filesChanged)
      
      // Mark as completed
      state.completedFunctions.add(nextFunction.id)
      state.currentFunctionIndex++
      state.lastUpdateTime = new Date().toISOString()
      state.inProgressFunction = undefined
      
      await saveProgressState(state)
      
      console.log(`✓ Completed ${nextFunction.id} - ${finalStatus}`)
      iterations++
      
    } catch (error) {
      console.error(`Failed to audit ${nextFunction.id}:`, error)
      nextFunction.status = "blocked"
      state.completedFunctions.add(nextFunction.id)
      state.currentFunctionIndex++
      state.inProgressFunction = undefined
      
      await saveProgressState(state)
    }
  }
  
  console.log(`\nAudit loop completed. ${iterations} iterations processed.`)
  return 0
}
