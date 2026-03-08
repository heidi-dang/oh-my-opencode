import { exec } from "node:child_process"
import { promisify } from "node:util"
import type { CoverageResult, CoverageSummary } from "./types"

const execAsync = promisify(exec)

export async function runCoverage(pattern: string, directory: string): Promise<CoverageSummary> {
  try {
    // We use ./ to ensure bun treats it as a path if it looks like one
    const cmd = `bun test ${pattern.startsWith("/") || pattern.startsWith(".") ? pattern : "./" + pattern} --coverage`
    const { stdout, stderr } = await execAsync(cmd, { cwd: directory }).catch((err) => err) // Bun test might return non-zero exit code if tests fail, but we still want the coverage report

    const output = stdout || stderr || ""
    return parseCoverageOutput(output)
  } catch (error) {
    throw new Error(`Failed to run coverage: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function parseCoverageOutput(output: string): CoverageSummary {
  const lines = output.split("\n")
  const results: CoverageResult[] = []
  let totalLinesPercent = 0
  let totalFunctionsPercent = 0

  let inTable = false
  for (const line of lines) {
    if (line.includes("File") && line.includes("% Funcs") && line.includes("% Lines")) {
      inTable = true
      continue
    }
    if (inTable && line.startsWith("----")) continue
    if (inTable && line.trim() === "") {
        inTable = false
        continue
    }

    if (inTable) {
      const parts = line.split("|").map(p => p.trim())
      if (parts.length >= 4) {
        const file = parts[0]
        const funcsPercent = parseFloat(parts[1]) || 0
        const linesPercent = parseFloat(parts[2]) || 0
        const uncoveredLines = parts[3] || ""

        if (file === "All files") {
          totalFunctionsPercent = funcsPercent
          totalLinesPercent = linesPercent
        } else {
          results.push({
            file,
            functionsPercent: funcsPercent,
            linesPercent: linesPercent,
            uncoveredLines
          })
        }
      }
    }
  }

  return {
    results,
    totalLinesPercent,
    totalFunctionsPercent
  }
}
