/**
 * Diff Verifier — Compares actual git diff vs planned file targets.
 *
 * CORE component (not optional). Catches:
 *   - Unrelated files changed (accidental side effects)
 *   - Oversized edits (formatting changes, import reordering)
 *   - Missing expected files from plan
 */

import { exec } from "child_process"
import { promisify } from "util"
import { log } from "../../shared/logger"
import type { DiffVerificationResult, TaskPlan } from "./types"

const execAsync = promisify(exec)

const OVERSIZED_THRESHOLD = 200 // lines changed per file

interface FileDiffStat {
  path: string
  insertions: number
  deletions: number
  total: number
}

async function getGitDiffStats(cwd: string): Promise<FileDiffStat[]> {
  try {
    const { stdout } = await execAsync("git diff --numstat HEAD", { cwd, timeout: 10000 })
    if (!stdout.trim()) {
      // Try staged changes
      const { stdout: staged } = await execAsync("git diff --numstat --cached", { cwd, timeout: 10000 })
      return parseDiffStats(staged)
    }
    return parseDiffStats(stdout)
  } catch {
    return []
  }
}

function parseDiffStats(output: string): FileDiffStat[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const [ins, del, filePath] = line.split("\t")
      const insertions = parseInt(ins, 10) || 0
      const deletions = parseInt(del, 10) || 0
      return { path: filePath, insertions, deletions, total: insertions + deletions }
    })
    .filter(s => s.path)
}

function getPlannedFilePaths(plan: TaskPlan): string[] {
  return plan.steps
    .filter(s => s.target_type === "file")
    .map(s => s.target_value)
}

/**
 * Verify that actual changes match the plan.
 */
export async function verifyDiff(
  plan: TaskPlan,
  cwd: string
): Promise<DiffVerificationResult> {
  const diffStats = await getGitDiffStats(cwd)
  const plannedFiles = getPlannedFilePaths(plan)
  const changedPaths = diffStats.map(s => s.path)

  // Unrelated files: changed but not in plan
  const unrelated = changedPaths.filter(p =>
    !plannedFiles.some(planned => p.includes(planned) || planned.includes(p))
  )

  // Missing expected: in plan but not changed
  const missing = plannedFiles.filter(p =>
    !changedPaths.some(changed => changed.includes(p) || p.includes(changed))
  )

  // Oversized edits
  const oversized = diffStats
    .filter(s => s.total > OVERSIZED_THRESHOLD)
    .map(s => `${s.path} (${s.total} lines)`)

  const totalLines = diffStats.reduce((sum, s) => sum + s.total, 0)
  const matchesPlan = unrelated.length === 0 && missing.length === 0

  if (!matchesPlan) {
    log(`[DiffVerifier] Plan mismatch: ${unrelated.length} unrelated, ${missing.length} missing, ${oversized.length} oversized`)
  } else {
    log(`[DiffVerifier] Diff matches plan: ${changedPaths.length} files, ${totalLines} lines`)
  }

  return {
    matches_plan: matchesPlan,
    unrelated_files: unrelated,
    oversized_edits: oversized,
    missing_expected_files: missing,
    total_lines_changed: totalLines,
  }
}
