/**
 * Verification command patterns for agent prompts.
 *
 * These define the canonical verification commands agents must use
 * when verifying side-effect operations. Agents reference these
 * patterns rather than inventing their own verification approaches.
 */

export const VERIFICATION_COMMANDS = {
    gitPush: {
        name: "Git Push Verification",
        command: 'git rev-list --count origin/${BRANCH}..HEAD',
        successCondition: 'output === "0"',
        failureMessage: "Push failed — unpushed commits remain",
    },
    gitCommit: {
        name: "Git Commit Verification",
        command: 'git log -1 --format="%H"',
        successCondition: "output !== previousHash",
        failureMessage: "Commit failed — hash unchanged from before work",
    },
    prCreated: {
        name: "PR Creation Verification",
        command: 'gh pr view --json url --jq ".url"',
        successCondition: 'output starts with "https://"',
        failureMessage: "PR not found — do not fabricate URL",
    },
    cleanWorkDir: {
        name: "Clean Working Directory",
        command: "git status --porcelain",
        successCondition: "output is empty",
        failureMessage: "Uncommitted changes exist — cannot proceed",
    },
    branchExists: {
        name: "Branch Existence",
        command: "git rev-parse --verify ${BRANCH}",
        successCondition: "exit code === 0",
        failureMessage: "Branch does not exist",
    },
    commandExit: {
        name: "Command Exit Code",
        command: "true",
        successCondition: "exit code === 0",
        failureMessage: "Command failed with non-zero exit code",
    },
    fileWrite: {
        name: "File Write Verification",
        command: "true",
        successCondition: "write tool returned success",
        failureMessage: "File write failed — check tool output",
    },
} as const

export type VerificationKey = keyof typeof VERIFICATION_COMMANDS

/**
 * Builds a prompt section that agents can reference for
 * canonical verification commands. This is injected into
 * agent prompts so they know exactly how to verify operations.
 */
export function buildVerificationPromptSection(): string {
    const entries = Object.entries(VERIFICATION_COMMANDS)
        .filter(([, v]) => v.command !== undefined)
        .map(([, v]) => `- **${v.name}**: \`${v.command}\` → success when ${v.successCondition}`)
        .join("\n")

    return `## Verification Commands Reference

Use these EXACT commands to verify operations. Do NOT invent alternatives.

${entries}

**Rule: If verification fails, report the failure. NEVER claim success.**`
}
