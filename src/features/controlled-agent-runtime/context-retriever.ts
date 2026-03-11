/**
 * Context Retriever — Repo-aware file retrieval for the CAR pipeline.
 *
 * Given likely_areas from the Task Interpreter, builds a compact context bundle
 * containing only the exact working set the agent needs. Replaces raw context stuffing.
 */

import { exec } from "child_process"
import { promisify } from "util"
import { readFile, readdir, stat } from "fs/promises"
import { join, dirname, basename } from "path"
import { log } from "../../shared/logger"

const execAsync = promisify(exec)

export interface ContextFile {
  path: string
  reason: "target" | "test" | "neighbor" | "config" | "schema"
  content?: string
  truncated?: boolean
}

export interface RecentCommit {
  hash: string
  message: string
  date: string
  files_changed: string[]
}

export interface ContextBundle {
  target_files: ContextFile[]
  related_tests: ContextFile[]
  config_files: ContextFile[]
  recent_commits: RecentCommit[]
  repo_conventions: string[]
}

const MAX_FILE_SIZE = 8000
const MAX_FILES = 8
const MAX_COMMITS = 5

async function findRelatedTests(filePath: string, cwd: string): Promise<string[]> {
  const dir = dirname(filePath)
  const base = basename(filePath, ".ts")
  const testPatterns = [
    join(dir, `${base}.test.ts`),
    join(dir, `${base}.spec.ts`),
    join(dir, "__tests__", `${base}.test.ts`),
  ]

  const found: string[] = []
  for (const pattern of testPatterns) {
    try {
      await stat(join(cwd, pattern))
      found.push(pattern)
    } catch {
      // File doesn't exist
    }
  }
  return found
}

async function findNeighborFiles(filePath: string, cwd: string): Promise<string[]> {
  const dir = dirname(filePath)
  try {
    const entries = await readdir(join(cwd, dir))
    return entries
      .filter(e => e.endsWith(".ts") && !e.endsWith(".test.ts") && !e.endsWith(".spec.ts"))
      .slice(0, 5)
      .map(e => join(dir, e))
  } catch {
    return []
  }
}

async function getRecentCommits(filePaths: string[], cwd: string): Promise<RecentCommit[]> {
  const commits: RecentCommit[] = []
  const seenHashes = new Set<string>()

  for (const filePath of filePaths.slice(0, 3)) {
    try {
      const { stdout } = await execAsync(
        `git log --follow -${MAX_COMMITS} --pretty=format:"%H|||%s|||%ai" -- "${filePath}"`,
        { cwd, timeout: 5000 }
      )
      for (const line of stdout.split("\n").filter(Boolean)) {
        const [hash, message, date] = line.split("|||")
        if (hash && !seenHashes.has(hash)) {
          seenHashes.add(hash)
          const { stdout: files } = await execAsync(
            `git diff-tree --no-commit-id --name-only -r ${hash}`,
            { cwd, timeout: 3000 }
          ).catch(() => ({ stdout: "" }))
          commits.push({
            hash: hash.substring(0, 8),
            message: message?.trim() ?? "",
            date: date?.trim() ?? "",
            files_changed: files.split("\n").filter(Boolean),
          })
        }
      }
    } catch (err) {
      log(`[ContextRetriever] Failed to get commits for ${filePath}:`, err)
    }
  }

  return commits.slice(0, MAX_COMMITS)
}

async function readFileSafe(filePath: string, cwd: string): Promise<{ content: string; truncated: boolean }> {
  try {
    const fullPath = join(cwd, filePath)
    const content = await readFile(fullPath, "utf-8")
    if (content.length > MAX_FILE_SIZE) {
      return { content: content.substring(0, MAX_FILE_SIZE) + "\n// ... truncated ...", truncated: true }
    }
    return { content, truncated: false }
  } catch {
    return { content: "", truncated: false }
  }
}

function detectConventions(files: ContextFile[]): string[] {
  const conventions: string[] = []
  for (const file of files) {
    if (!file.content) continue
    if (file.content.includes("bun:test")) conventions.push("Test framework: bun:test")
    if (file.content.includes("import { z }") || file.content.includes("from \"zod\"")) conventions.push("Validation: Zod")
    if (file.content.includes("@opencode-ai/plugin")) conventions.push("Plugin system: @opencode-ai/plugin")
    if (file.content.includes("export function create")) conventions.push("Pattern: createXXX factory functions")
  }
  return [...new Set(conventions)]
}

export async function buildContextBundle(
  likelyAreas: string[],
  cwd: string
): Promise<ContextBundle> {
  const targetFiles: ContextFile[] = []
  const relatedTests: ContextFile[] = []
  const configFiles: ContextFile[] = []
  let filesProcessed = 0

  for (const area of likelyAreas) {
    if (filesProcessed >= MAX_FILES) break

    const { content, truncated } = await readFileSafe(area, cwd)
    if (content) {
      targetFiles.push({ path: area, reason: "target", content, truncated })
      filesProcessed++

      const tests = await findRelatedTests(area, cwd)
      for (const testPath of tests) {
        if (filesProcessed >= MAX_FILES) break
        const testData = await readFileSafe(testPath, cwd)
        relatedTests.push({ path: testPath, reason: "test", content: testData.content, truncated: testData.truncated })
        filesProcessed++
      }
    } else {
      const neighbors = await findNeighborFiles(area, cwd)
      for (const neighbor of neighbors) {
        if (filesProcessed >= MAX_FILES) break
        const neighborData = await readFileSafe(neighbor, cwd)
        if (neighborData.content) {
          targetFiles.push({ path: neighbor, reason: "neighbor", content: neighborData.content, truncated: neighborData.truncated })
          filesProcessed++
        }
      }
    }
  }

  const recentCommits = await getRecentCommits(likelyAreas, cwd)
  const conventions = detectConventions(targetFiles)

  log(`[ContextRetriever] Bundle: ${targetFiles.length} targets, ${relatedTests.length} tests, ${recentCommits.length} commits`)

  return {
    target_files: targetFiles,
    related_tests: relatedTests,
    config_files: configFiles,
    recent_commits: recentCommits,
    repo_conventions: conventions,
  }
}
