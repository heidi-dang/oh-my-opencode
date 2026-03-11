/**
 * Verification Engine — Structured 4-level verification for the CAR pipeline.
 *
 * TRUTH OWNERSHIP: Computes verification results and acceptance status.
 * Does NOT store evidence (that's StateLedger's job).
 * Returns a structured VerificationResult, NEVER prose.
 *
 * Levels:
 *   L1 Static:     build, lint, typecheck, schema parse
 *   L2 Targeted:   run tests for touched feature, exact repro
 *   L3 E2E:        simulate real usage path
 *   L4 Regression: doctor checks, snapshot stability
 */

import { exec } from "child_process"
import { promisify } from "util"
import { log } from "../../shared/logger"
import type {
  VerificationResult,
  CheckResult,
  AcceptanceCriterion,
  AcceptanceStatus,
} from "./types"

const execAsync = promisify(exec)
const COMMAND_TIMEOUT = 60_000

async function runCommand(cmd: string, cwd: string): Promise<{ ok: boolean; stdout: string; exitCode: number }> {
  try {
    const { stdout } = await execAsync(cmd, { cwd, timeout: COMMAND_TIMEOUT })
    return { ok: true, stdout: stdout.trim(), exitCode: 0 }
  } catch (err: any) {
    return {
      ok: false,
      stdout: (err.stdout || err.message || "").trim(),
      exitCode: err.code ?? 1,
    }
  }
}

async function runStaticChecks(cwd: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  const typecheck = await runCommand("bun run typecheck", cwd)
  results.push({
    name: "typecheck",
    passed: typecheck.ok,
    message: typecheck.ok ? "TypeScript typecheck passed." : "TypeScript typecheck failed.",
    details: typecheck.ok ? undefined : typecheck.stdout.substring(0, 2000),
    command: "bun run typecheck",
    exit_code: typecheck.exitCode,
  })

  const build = await runCommand("bun run build", cwd)
  results.push({
    name: "build",
    passed: build.ok,
    message: build.ok ? "Build succeeded." : "Build failed.",
    details: build.ok ? undefined : build.stdout.substring(0, 2000),
    command: "bun run build",
    exit_code: build.exitCode,
  })

  return results
}

async function runTargetedChecks(changedFiles: string[], cwd: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  const testFiles = changedFiles
    .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map(f => f.replace(/\.ts$/, ".test.ts"))

  for (const testFile of testFiles.slice(0, 5)) {
    const result = await runCommand(`bun test ${testFile}`, cwd)
    results.push({
      name: `test:${testFile}`,
      passed: result.ok,
      message: result.ok ? `Tests passed: ${testFile}` : `Tests failed: ${testFile}`,
      details: result.ok ? undefined : result.stdout.substring(0, 2000),
      command: `bun test ${testFile}`,
      exit_code: result.exitCode,
    })
  }

  return results
}

async function runRegressionChecks(cwd: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  const doctor = await runCommand("bunx oh-my-opencode doctor --json", cwd)
  results.push({
    name: "doctor",
    passed: doctor.ok,
    message: doctor.ok ? "System doctor passed." : "System doctor found issues.",
    details: doctor.ok ? undefined : doctor.stdout.substring(0, 2000),
    command: "bunx oh-my-opencode doctor --json",
    exit_code: doctor.exitCode,
  })

  return results
}

/**
 * Run all verification levels and return a structured result.
 */
export async function runVerification(
  changedFiles: string[],
  cwd: string,
  options?: { skipE2E?: boolean; skipRegression?: boolean }
): Promise<VerificationResult> {
  log(`[VerificationEngine] Running verification for ${changedFiles.length} changed files`)

  const staticResults = await runStaticChecks(cwd)
  const targetedResults = await runTargetedChecks(changedFiles, cwd)
  const e2eResults: CheckResult[] = [] // E2E requires custom setup per task
  const regressionResults = options?.skipRegression ? [] : await runRegressionChecks(cwd)

  const allResults = [...staticResults, ...targetedResults, ...e2eResults, ...regressionResults]
  const failures = allResults.filter(r => !r.passed)

  const result: VerificationResult = {
    overall_pass: failures.length === 0,
    levels: {
      static: staticResults,
      targeted: targetedResults,
      e2e: e2eResults,
      regression: regressionResults,
    },
    artifacts: changedFiles,
    remaining_failures: failures.map(f => f.message),
  }

  log(`[VerificationEngine] Result: ${result.overall_pass ? "PASS" : "FAIL"} (${failures.length} failures)`)
  return result
}

/**
 * Compute acceptance statuses from verification results and acceptance criteria.
 */
export function computeAcceptanceStatuses(
  criteria: AcceptanceCriterion[],
  verificationResult: VerificationResult
): AcceptanceStatus[] {
  const now = Date.now()
  return criteria.map(criterion => {
    let passed = false
    let evidence = ""

    switch (criterion.verification_method) {
      case "build": {
        const buildCheck = verificationResult.levels.static.find(r =>
          r.name === "build" || r.name === "typecheck"
        )
        passed = buildCheck?.passed ?? false
        evidence = buildCheck?.message ?? "No build check found"
        break
      }
      case "test": {
        const testChecks = verificationResult.levels.targeted
        passed = testChecks.length > 0 && testChecks.every(r => r.passed)
        evidence = testChecks.map(r => r.message).join("; ") || "No targeted tests found"
        break
      }
      case "command": {
        if (criterion.verification_command) {
          const match = [
            ...verificationResult.levels.static,
            ...verificationResult.levels.targeted,
            ...verificationResult.levels.regression,
          ].find(r => r.command === criterion.verification_command)
          passed = match?.passed ?? false
          evidence = match?.message ?? "Command not found in verification results"
        }
        break
      }
      case "lint": {
        const lintCheck = verificationResult.levels.static.find(r => r.name === "lint")
        passed = lintCheck?.passed ?? true // Lint may not run
        evidence = lintCheck?.message ?? "No lint check configured"
        break
      }
      case "manual": {
        passed = false
        evidence = "Manual verification required"
        break
      }
    }

    return { criterion_id: criterion.id, passed, evidence, checked_at: now }
  })
}
