/**
 * Default Config Doctor Check
 *
 * Verifies that the default config infrastructure is present and correct:
 * 1. assets/default-oh-my-opencode.json exists and is valid JSON
 * 2. oh-my-opencode init command is registered in cli-program.ts
 * 3. README mentions `oh-my-opencode init`
 */

import { existsSync, readFileSync } from "node:fs"
import * as path from "node:path"
import { CHECK_IDS, CHECK_NAMES } from "../constants"
import type { CheckResult, DoctorIssue } from "../types"

const ASSET_FILENAME = "default-oh-my-opencode.json"

function findRepoRoot(): string | null {
    // Walk up from process.cwd() to find the repo root (contains package.json with our name)
    let dir = process.cwd()
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, "package.json")
        if (existsSync(candidate)) {
            try {
                const pkg = JSON.parse(readFileSync(candidate, "utf-8"))
                if (pkg.name === "@heidi-dang/oh-my-opencode") {
                    return dir
                }
            } catch {
                // continue
            }
        }
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return null
}

function checkAssetFile(repoRoot: string | null): DoctorIssue | null {
    if (!repoRoot) {
        // Can't check without repo root — skip
        return null
    }

    const assetPath = path.join(repoRoot, "assets", ASSET_FILENAME)

    if (!existsSync(assetPath)) {
        return {
            title: "Default config asset missing",
            description: `assets/${ASSET_FILENAME} not found in repo root.`,
            fix: `Create assets/${ASSET_FILENAME} with the Heidi performance default config.`,
            severity: "error",
            affects: ["oh-my-opencode init"],
        }
    }

    // Validate JSON
    try {
        const content = readFileSync(assetPath, "utf-8")
        JSON.parse(content)
    } catch (err) {
        return {
            title: "Default config asset is invalid JSON",
            description: `assets/${ASSET_FILENAME} contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            fix: `Fix JSON syntax in assets/${ASSET_FILENAME}.`,
            severity: "error",
            affects: ["oh-my-opencode init"],
        }
    }

    return null
}

function checkInitCommandPresent(repoRoot: string | null): DoctorIssue | null {
    if (!repoRoot) return null

    const cliProgramPath = path.join(repoRoot, "src", "cli", "cli-program.ts")
    if (!existsSync(cliProgramPath)) return null

    try {
        const content = readFileSync(cliProgramPath, "utf-8")
        if (!content.includes("\"init\"") && !content.includes("'init'")) {
            return {
                title: "init command not registered",
                description: "src/cli/cli-program.ts does not register an 'init' command.",
                fix: "Add oh-my-opencode init command to cli-program.ts.",
                severity: "error",
                affects: ["oh-my-opencode init"],
            }
        }
    } catch {
        // Skip
    }

    return null
}

function checkReadmeMentionsInit(repoRoot: string | null): DoctorIssue | null {
    if (!repoRoot) return null

    const readmePath = path.join(repoRoot, "README.md")
    if (!existsSync(readmePath)) return null

    try {
        const content = readFileSync(readmePath, "utf-8")
        if (!content.includes("oh-my-opencode init") && !content.includes("omo init")) {
            return {
                title: "README does not mention oh-my-opencode init",
                description: "README.md install section should guide users to run oh-my-opencode init.",
                fix: "Add `oh-my-opencode init` to the README install section.",
                severity: "warning",
                affects: ["docs"],
            }
        }
    } catch {
        // Skip
    }

    return null
}

export async function checkDefaultConfig(): Promise<CheckResult> {
    const issues: DoctorIssue[] = []
    const repoRoot = findRepoRoot()

    const assetIssue = checkAssetFile(repoRoot)
    if (assetIssue) issues.push(assetIssue)

    const initIssue = checkInitCommandPresent(repoRoot)
    if (initIssue) issues.push(initIssue)

    const readmeIssue = checkReadmeMentionsInit(repoRoot)
    if (readmeIssue) issues.push(readmeIssue)

    const errorCount = issues.filter((i) => i.severity === "error").length
    const warnCount = issues.filter((i) => i.severity === "warning").length
    const status = errorCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass"

    return {
        name: CHECK_NAMES[CHECK_IDS.DEFAULT_CONFIG],
        status,
        message:
            status === "pass"
                ? `Default config asset valid, init command registered`
                : `${errorCount} error(s), ${warnCount} warning(s)`,
        issues,
    }
}
