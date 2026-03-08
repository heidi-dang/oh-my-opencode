import { exec } from "node:child_process"
import { promisify } from "node:util"
import { join, relative, dirname } from "node:path"

const execAsync = promisify(exec)

export async function analyzeDependencies(path: string, directory: string): Promise<string> {
  try {
    const searchPath = join(directory, path)
    // Find all .ts and .tsx files
    const { stdout: filesOutput } = await execAsync(`find ${searchPath} -name "*.ts" -o -name "*.tsx"`)
    const files = filesOutput.split("\n").filter(f => f.trim() !== "")

    const graph: Record<string, string[]> = {}

    for (const file of files) {
      const relFile = relative(directory, file)
      const { stdout: importLines } = await execAsync(`grep -h "^import.*from" "${file}"`).catch(() => ({ stdout: "" }))
      
      const imports: string[] = []
      const lines = importLines.split("\n")
      for (const line of lines) {
        const match = line.match(/from\s+["']([^"']+)["']/)
        if (match) {
          let importPath = match[1]
          if (importPath.startsWith(".")) {
            // Resolve relative import to project relative
             imports.push(importPath) 
          }
        }
      }
      graph[relFile] = imports
    }

    return generateMermaid(graph)
  } catch (error) {
    throw new Error(`Failed to analyze dependencies: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function generateMermaid(graph: Record<string, string[]>): string {
  let mermaid = "graph TD\n"
  const nodes = Object.keys(graph)
  
  for (const node of nodes) {
    const imports = graph[node]
    for (const imp of imports) {
      mermaid += `  "${node}" --> "${imp}"\n`
    }
  }
  return "```mermaid\n" + mermaid + "```"
}
