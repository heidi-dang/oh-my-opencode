import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export async function getDiff(directory: string, baseBranch = "main"): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff ${baseBranch}...HEAD`, { cwd: directory })
    return stdout
  } catch (error) {
    throw new Error(`Failed to get diff: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function getCommitMessages(directory: string, baseBranch = "main"): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`git log ${baseBranch}..HEAD --oneline`, { cwd: directory })
    return stdout.split("\n").filter(l => l.trim() !== "")
  } catch (error) {
    return []
  }
}
