import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { execSync } from "node:child_process"
import { parse } from "@ast-grep/napi"
import type { FunctionInventory, AuditFunction, FunctionCategory } from "./types"

const ROOT_DIR = process.cwd()
const DOCS_DIR = join(ROOT_DIR, "docs", "self-audit")
const FUNCTIONS_DIR = join(DOCS_DIR, "functions")

const EXCLUDE_PATTERNS = [
  "node_modules/**",
  "dist/**", 
  "build/**",
  ".git/**",
  "coverage/**",
  "*.test.ts",
  "*.test.js",
  "*.spec.ts",
  "*.spec.js",
  "**/fixtures/**",
  "**/snapshots/**",
  "**/vendor/**",
  "**/generated/**"
]

const INCLUDE_EXTENSIONS = [".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs"]

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript", 
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript"
}

function categorizeFunction(filePath: string, functionName: string): FunctionCategory {
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

function generateStableId(filePath: string, functionName: string, language: string, lineStart?: number): string {
  const relativePath = relative(ROOT_DIR, filePath)
  const baseId = `${relativePath}::${functionName}::${language}`
  
  if (lineStart !== undefined) {
    return `${baseId}::line${lineStart}`
  }
  
  return baseId
}

async function findSourceFiles(): Promise<string[]> {
  const gitFiles = execSync("git ls-files", { encoding: "utf-8", cwd: ROOT_DIR })
    .split("\n")
    .filter(Boolean)
    .map(line => line.trim())
  
  const sourceFiles = gitFiles.filter(file => {
    if (EXCLUDE_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"))
      return regex.test(file)
    })) {
      return false
    }
    
    return INCLUDE_EXTENSIONS.some(ext => file.endsWith(ext))
  })
  
  return sourceFiles.map(file => join(ROOT_DIR, file))
}

async function extractFunctionsFromFile(filePath: string): Promise<AuditFunction[]> {
  const content = await readFile(filePath, "utf-8")
  const ext = filePath.slice(filePath.lastIndexOf("."))
  const language = LANGUAGE_MAP[ext] || "unknown"
  
  if (!language || language === "unknown") {
    return []
  }
  
  const functions: AuditFunction[] = []
  const lines = content.split("\n")
  
  // Simple regex-based function extraction for now
  const functionPatterns = [
    /(?:function\s+(\w+)|async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|(\w+)\s*\([^)]*\)\s*[{:]|export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g
  ]
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    
    for (const pattern of functionPatterns) {
      const matches = [...line.matchAll(pattern)]
      
      for (const match of matches) {
        const functionName = match[1] || match[2] || match[3] || match[4] || match[5] || match[6] || "anonymous"
        
        if (functionName && functionName !== "anonymous") {
          functions.push({
            id: generateStableId(filePath, functionName, language, lineNum + 1),
            filePath,
            functionName,
            signature: line.trim(),
            language,
            category: categorizeFunction(filePath, functionName),
            status: "pending",
            lineStart: lineNum + 1,
            lineEnd: lineNum + 1
          })
        }
      }
    }
  }
  
  return functions
}

async function getCurrentCommitSha(): Promise<string> {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: ROOT_DIR }).trim()
  } catch {
    return "unknown"
  }
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function generateInventory(refresh: boolean = false): Promise<number> {
  await ensureDir(DOCS_DIR)
  await ensureDir(FUNCTIONS_DIR)
  
  const indexPath = join(DOCS_DIR, "index.txt")
  const progressPath = join(DOCS_DIR, "progress.txt")
  
  if (!refresh) {
    try {
      const existingIndex = await readFile(indexPath, "utf-8")
      if (existingIndex.includes("total function count")) {
        console.log("Inventory already exists. Use --refresh to regenerate.")
        return 0
      }
    } catch {
      // File doesn't exist, continue
    }
  }
  
  console.log("Scanning repository for functions...")
  
  const sourceFiles = await findSourceFiles()
  console.log(`Found ${sourceFiles.length} source files`)
  
  const allFunctions: AuditFunction[] = []
  
  for (const filePath of sourceFiles) {
    const functions = await extractFunctionsFromFile(filePath)
    allFunctions.push(...functions)
    
    if (functions.length > 0) {
      console.log(`Found ${functions.length} functions in ${relative(ROOT_DIR, filePath)}`)
    }
  }
  
  // Sort by file path and function name for stable ordering
  allFunctions.sort((a, b) => {
    const pathCompare = a.filePath.localeCompare(b.filePath)
    if (pathCompare !== 0) return pathCompare
    return a.functionName.localeCompare(b.functionName)
  })
  
  const commitSha = await getCurrentCommitSha()
  const timestamp = new Date().toISOString()
  
  const inventory: FunctionInventory = {
    functions: allFunctions,
    total: allFunctions.length,
    generated: timestamp,
    commitSha
  }
  
  // Write detailed index
  const indexContent = [
    `# Self-Audit Function Inventory`,
    `Generated: ${timestamp}`,
    `Commit SHA: ${commitSha}`,
    ``,
    `## Summary`,
    `Total function count: ${allFunctions.length}`,
    `Completed count: 0`,
    `Fixed count: 0`,
    `Improved count: 0`,
    `No-change pass count: 0`,
    `Blocked count: 0`,
    `Remaining count: ${allFunctions.length}`,
    `Percent complete: 0%`,
    `Last processed function: none`,
    `Latest commit SHA: ${commitSha}`,
    ``,
    `## Function Inventory`,
    ...allFunctions.map(func => 
      `${func.status}\t${func.id}\t${func.reportPath || "no-report"}`
    )
  ].join("\n")
  
  await writeFile(indexPath, indexContent)
  
  // Write progress log
  const progressContent = [
    `# Self-Audit Progress Log`,
    `Started: ${timestamp}`,
    `Commit SHA: ${commitSha}`,
    ``,
    `## Inventory Generation`,
    `Functions discovered: ${allFunctions.length}`,
    `Files scanned: ${sourceFiles.length}`,
    `Categories: ${[...new Set(allFunctions.map(f => f.category))].join(", ")}`,
    ``,
    `## Audit Iterations`,
    `No iterations completed yet.`
  ].join("\n")
  
  await writeFile(progressPath, progressContent)
  
  console.log(`\nInventory complete!`)
  console.log(`- ${allFunctions.length} functions found`)
  console.log(`- ${sourceFiles.length} files scanned`) 
  console.log(`- Index: ${relative(ROOT_DIR, indexPath)}`)
  console.log(`- Progress: ${relative(ROOT_DIR, progressPath)}`)
  
  return 0
}
