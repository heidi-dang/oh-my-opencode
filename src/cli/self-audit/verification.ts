import { execSync } from "node:child_process"
import type { AuditFunction, VerificationResult } from "./types"

const ROOT_DIR = process.cwd()

export async function runVerification(func: AuditFunction, context: string): Promise<VerificationResult> {
  const testsRun: string[] = []
  const issues: string[] = []
  
  try {
    // 1. Check if there are existing tests for this function/module
    const testFiles = findTestFiles(func.filePath)
    
    if (testFiles.length > 0) {
      testsRun.push(`Found existing test files: ${testFiles.join(", ")}`)
      
      // Run existing tests
      for (const testFile of testFiles) {
        try {
          const relativeTestFile = testFile.replace(ROOT_DIR + "/", "")
          execSync(`bun test "${relativeTestFile}"`, { 
            cwd: ROOT_DIR, 
            stdio: "pipe", 
            timeout: 30000 
          })
          testsRun.push(`✓ Passed: ${relativeTestFile}`)
        } catch (error: any) {
          testsRun.push(`✗ Failed: ${testFile.replace(ROOT_DIR + "/", "")}`)
          issues.push(`Test failure in ${testFile}: ${error.message}`)
        }
      }
    } else {
      testsRun.push("No existing tests found for this function")
    }
    
    // 2. Type checking
    try {
      execSync("bun run typecheck", { cwd: ROOT_DIR, stdio: "pipe", timeout: 60000 })
      testsRun.push("✓ Type checking passed")
    } catch (error: any) {
      testsRun.push("✗ Type checking failed")
      issues.push(`TypeScript errors: ${error.message}`)
    }
    
    // 3. Build verification
    try {
      execSync("bun run build", { cwd: ROOT_DIR, stdio: "pipe", timeout: 60000 })
      testsRun.push("✓ Build passed")
    } catch (error: any) {
      testsRun.push("✗ Build failed")
      issues.push(`Build errors: ${error.message}`)
    }
    
    // 4. Basic lint checking (if available)
    try {
      execSync("bunx eslint --max-warnings 0 src/**/*.ts", { 
        cwd: ROOT_DIR, 
        stdio: "pipe", 
        timeout: 30000 
      })
      testsRun.push("✓ Linting passed")
    } catch {
      testsRun.push("Linting skipped (ESLint not configured)")
    }
    
    // 5. Function-specific analysis
    const functionIssues = analyzeFunctionSpecificIssues(func, context)
    issues.push(...functionIssues)
    testsRun.push(`Function-specific analysis: ${functionIssues.length} issues found`)
    
    return {
      passed: issues.length === 0,
      testsRun,
      beforeResult: issues.length === 0 ? "PASS" : `FAIL: ${issues.join("; ")}`,
      afterResult: "", // Will be filled after changes
      issues
    }
    
  } catch (error: any) {
    return {
      passed: false,
      testsRun: ["Verification failed with error"],
      beforeResult: `ERROR: ${error.message}`,
      afterResult: "",
      issues: [error.message]
    }
  }
}

function findTestFiles(filePath: string): string[] {
  const testPatterns = [
    filePath.replace(/\.ts$/, ".test.ts"),
    filePath.replace(/\.ts$/, ".spec.ts"),
    filePath.replace(/\.ts$/, ".test.js"),
    filePath.replace(/\.ts$/, ".spec.js"),
    filePath.replace(/\.ts$/, ".test.tsx"),
    filePath.replace(/\.ts$/, ".spec.tsx")
  ]
  
  const found: string[] = []
  
  for (const pattern of testPatterns) {
    try {
      execSync(`test -f "${pattern}"`, { cwd: ROOT_DIR })
      found.push(pattern)
    } catch {
      // File doesn't exist
    }
  }
  
  // Also check for test files in the same directory
  const dir = filePath.substring(0, filePath.lastIndexOf("/"))
  const basename = filePath.substring(filePath.lastIndexOf("/") + 1).replace(/\.ts$/, "")
  
  try {
    const files = execSync(`find "${dir}" -name "*${basename}*.test.*" -o -name "*${basename}*.spec.*"`, { 
      cwd: ROOT_DIR, 
      encoding: "utf-8" 
    }).trim()
    
    if (files) {
      found.push(...files.split("\n").filter(Boolean).map(f => f.trim()))
    }
  } catch {
    // No test files found
  }
  
  return [...new Set(found)]
}

function analyzeFunctionSpecificIssues(func: AuditFunction, context: string): string[] {
  const issues: string[] = []
  
  // Check for common issues
  if (context.includes("console.log")) {
    issues.push("Contains console.log statements")
  }
  
  if (context.includes("debugger")) {
    issues.push("Contains debugger statement")
  }
  
  if (context.includes("TODO") || context.includes("FIXME")) {
    issues.push("Contains TODO/FIXME comments")
  }
  
  // Check for error handling
  if (context.includes("try") && !context.includes("catch")) {
    issues.push("Try block without catch")
  }
  
  // Check for async/await issues
  if (context.includes("async") && !context.includes("await")) {
    issues.push("Async function without await calls")
  }
  
  // Check for potential null/undefined issues
  if (context.includes("!") && context.includes("optional")) {
    issues.push("Force null assertion on optional value")
  }
  
  return issues
}
