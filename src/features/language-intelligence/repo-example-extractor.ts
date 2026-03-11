import * as fs from "fs"
import * as path from "path"
import { log } from "../../shared/logger"

export interface RepoExample {
  type: "test_style" | "logging_style" | "error_style" | "cli_style"
  content: string
  sourceFile: string
}

export class RepoExampleExtractor {
  private baseDir: string
  private examples: RepoExample[] = []
  private isExtracted: boolean = false

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  public async extractIfNeeded(): Promise<RepoExample[]> {
    if (this.isExtracted) {
      return this.examples
    }

    try {
      await this.extractTestStyles()
      await this.extractCliStyles()
      await this.extractErrorStyles()
      
      this.isExtracted = true
    } catch (err) {
      log(`[RepoExampleExtractor] Error extracting examples:`, err)
    }

    return this.examples
  }

  private async extractTestStyles(): Promise<void> {
    // Look for test files
    const allFiles = this.getAllFiles(this.baseDir, [], 0)
    
    // Find first 2 test files
    const testFiles = allFiles.filter(f => 
      f.endsWith(".test.ts") || 
      f.endsWith(".spec.ts") || 
      f.endsWith(".test.js") || 
      f.endsWith("spec.js") ||
      f.endsWith("test_*.py") ||
      f.endsWith("_test.py")
    ).slice(0, 2)

    for (const testFile of testFiles) {
      try {
        const content = fs.readFileSync(testFile, "utf-8")
        // Get the first 500 characters or the first block of imports + setup
        const snippet = content.slice(0, 800)
        
        this.examples.push({
          type: "test_style",
          content: snippet,
          sourceFile: path.relative(this.baseDir, testFile)
        })
      } catch (err) {
        // ignore read errors
      }
    }
  }

  private async extractCliStyles(): Promise<void> {
    try {
      const packageJsonPath = path.join(this.baseDir, "package.json")
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
        if (pkg.scripts) {
          const scriptsKeys = Object.keys(pkg.scripts).join(", ")
          this.examples.push({
            type: "cli_style",
            content: `Available npm scripts: ${scriptsKeys}\nExample: npm run ${Object.keys(pkg.scripts)[0] || "build"}`,
            sourceFile: "package.json"
          })
        }
      }
    } catch (err) {
      // ignore
    }
  }

  private async extractErrorStyles(): Promise<void> {
    const allFiles = this.getAllFiles(this.baseDir, [], 0)
    
    // Find files that might contain custom errors
    const errorFiles = allFiles.filter(f => 
      f.endsWith("errors.ts") || 
      f.endsWith("error.ts") || 
      f.endsWith("exceptions.py") || 
      f.endsWith("errors.py")
    ).slice(0, 1)

    for (const errorFile of errorFiles) {
      try {
        const content = fs.readFileSync(errorFile, "utf-8")
        const snippet = content.slice(0, 500)
        
        this.examples.push({
          type: "error_style",
          content: snippet,
          sourceFile: path.relative(this.baseDir, errorFile)
        })
      } catch (err) {
        // ignore
      }
    }
  }

  // Simple recursive directory walker (limited to avoid massive traversal)
  private getAllFiles(dirPath: string, arrayOfFiles: string[], depth: number): string[] {
    if (depth > 4) return arrayOfFiles // Limit depth

    let files: fs.Dirent[]
    try {
      files = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch (err) {
      return arrayOfFiles
    }

    for (const file of files) {
      if (file.isDirectory()) {
        if (file.name !== "node_modules" && file.name !== ".git" && file.name !== "dist" && file.name !== ".venv" && file.name !== "__pycache__") {
           arrayOfFiles = this.getAllFiles(path.join(dirPath, file.name), arrayOfFiles, depth + 1)
        }
      } else {
        arrayOfFiles.push(path.join(dirPath, file.name))
      }
    }

    return arrayOfFiles
  }

  public formatForInjection(): string {
    if (this.examples.length === 0) {
      return ""
    }

    const sections = []
    sections.push("### [REPO LOCAL EXAMPLES]")
    sections.push("This repository uses specific styles and patterns. Adhere to them when writing new code:")
    
    for (const example of this.examples) {
      sections.push(`\n#### Example: ${example.type} (from \`${example.sourceFile}\`)`)
      sections.push("```")
      sections.push(example.content)
      sections.push("...\n```")
    }

    return sections.join("\n")
  }
}
