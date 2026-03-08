import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export async function runBench(path: string, directory: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`bun test ${path} --bench`, { cwd: directory }).catch(err => err)
    return stdout || stderr || ""
  } catch (error) {
    throw new Error(`Failed to run benchmarks: ${error instanceof Error ? error.message : String(error)}`)
  }
}
