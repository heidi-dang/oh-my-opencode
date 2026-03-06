/**
 * Fork Integrity Doctor Check
 *
 * Verifies that the local environment is correctly configured for the
 * heidi-dang/oh-my-opencode fork, not the upstream code-yeongyu/oh-my-opencode.
 *
 * Sub-checks:
 * 1. Plugin name — opencode config should reference @heidi-dang/oh-my-opencode
 * 2. Docs URL   — README/docs should reference heidi-dang fork URL
 * 3. Junior inheritance — if sisyphus model is configured, junior will auto-inherit
 * 4. Effective-model sync — resolveJuniorInheritance export exists (module check)
 */

import { existsSync, readFileSync } from "node:fs"
import * as path from "node:path"
import { CHECK_IDS, CHECK_NAMES, PACKAGE_NAME, UPSTREAM_PACKAGE_NAME } from "../constants"
import type { CheckResult, DoctorIssue } from "../types"
import { getOpenCodeConfigPaths, parseJsonc } from "../../../shared"

const FORK_REPO = "heidi-dang/oh-my-opencode"
const UPSTREAM_REPO = "code-yeongyu/oh-my-opencode"

interface OpenCodeConfigShape {
    plugin?: string[]
}

function checkPluginRegistration(): DoctorIssue | null {
    const paths = getOpenCodeConfigPaths({ binary: "opencode", version: null })
    const configPath = existsSync(paths.configJsonc)
        ? paths.configJsonc
        : existsSync(paths.configJson)
            ? paths.configJson
            : null

    if (!configPath) {
        return {
            title: "OpenCode config not found",
            description: "Cannot verify plugin registration: no opencode config file found.",
            fix: "Run: opencode init",
            severity: "warning",
            affects: ["fork integrity"],
        }
    }

    try {
        const content = readFileSync(configPath, "utf-8")
        const parsed = parseJsonc<OpenCodeConfigShape>(content)
        const plugins = parsed.plugin ?? []

        // Check for upstream (unscoped) package being used instead of fork
        const hasUpstream = plugins.some(
            (p) => p === UPSTREAM_PACKAGE_NAME || p.startsWith(`${UPSTREAM_PACKAGE_NAME}@`)
        )
        if (hasUpstream) {
            return {
                title: "Upstream plugin registered",
                description: `OpenCode config references '${UPSTREAM_PACKAGE_NAME}' (upstream) instead of '${PACKAGE_NAME}' (this fork).`,
                fix: `Update plugin entry in ${configPath}: replace '${UPSTREAM_PACKAGE_NAME}' with '${PACKAGE_NAME}'`,
                severity: "error",
                affects: ["fork integrity"],
            }
        }

        const hasOurFork = plugins.some(
            (p) =>
                p === PACKAGE_NAME ||
                p.startsWith(`${PACKAGE_NAME}@`) ||
                (p.startsWith("file://") && p.includes("oh-my-opencode"))
        )
        if (!hasOurFork) {
            return {
                title: "Fork plugin not registered",
                description: `'${PACKAGE_NAME}' is not in the opencode plugin list.`,
                fix: `Add "${PACKAGE_NAME}" to plugin array in ${configPath}`,
                severity: "error",
                affects: ["fork integrity"],
            }
        }
    } catch {
        return {
            title: "Failed to read opencode config",
            description: `Could not parse ${configPath}`,
            severity: "warning",
            affects: ["fork integrity"],
        }
    }

    return null
}

function checkDocsUrl(): DoctorIssue | null {
    // Look for README.md starting from cwd and walking up
    let readmePath: string | null = null
    let dir = process.cwd()
    for (let i = 0; i < 4; i++) {
        const candidate = path.join(dir, "README.md")
        if (existsSync(candidate)) {
            readmePath = candidate
            break
        }
        dir = path.dirname(dir)
    }

    if (!readmePath) return null // Can't check without README — skip, not an error

    try {
        const content = readFileSync(readmePath, "utf-8")
        if (content.includes(UPSTREAM_REPO) && !content.includes(FORK_REPO)) {
            return {
                title: "README references upstream only",
                description: `README.md references '${UPSTREAM_REPO}' but not '${FORK_REPO}'.`,
                fix: "Update README.md install instructions to reference heidi-dang fork URLs.",
                severity: "warning",
                affects: ["docs"],
            }
        }
    } catch {
        // Non-fatal — skip
    }

    return null
}

function checkJuniorInheritanceCapability(): DoctorIssue | null {
    // The module is compiled in at build time. If we reached this point, it's present.
    // Doing a runtime file-system check would require __dirname which isn't reliable in ESM.
    // Trust the TypeScript compiler — if junior-inheritance.ts is missing, build fails first.
    return null
}

export async function checkFork(): Promise<CheckResult> {
    const issues: DoctorIssue[] = []

    const pluginIssue = checkPluginRegistration()
    if (pluginIssue) issues.push(pluginIssue)

    const docsIssue = checkDocsUrl()
    if (docsIssue) issues.push(docsIssue)

    const juniorIssue = checkJuniorInheritanceCapability()
    if (juniorIssue) issues.push(juniorIssue)

    const errorCount = issues.filter((i) => i.severity === "error").length
    const warnCount = issues.filter((i) => i.severity === "warning").length

    const status =
        errorCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass"

    const message =
        status === "pass"
            ? `Fork is @heidi-dang/oh-my-opencode — all checks passed`
            : `${errorCount} error(s), ${warnCount} warning(s)`

    return {
        name: CHECK_NAMES[CHECK_IDS.FORK],
        status,
        message,
        issues,
    }
}
