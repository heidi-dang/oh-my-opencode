import { existsSync, readFileSync, writeFileSync } from "fs"
import { spawnSync } from "child_process"
import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"
import { readTracker } from "../../shared/read-permission-tracker"

/**
 * Edit Safeguard Hook
 * 
 * Ensures file edits are atomic and syntactically valid.
 * 1. Before edit: Backs up the file content.
 * 2. After edit: 
 *    - Detects failure patterns ("oldString not found").
 *    - Restores backup if failure detected but file changed.
 *    - Validates syntax (Python).
 *    - Restores backup if syntax validation fails.
 */

const FAILURE_PATTERNS = [
    "oldstring not found",
    "oldstring found multiple times",
    "oldstring and newstring must be different",
    "verification failed",
    "failed to find expected lines"
]

export function createEditSafeguardHook(ctx: PluginInput): Hooks {
    const backups = new Map<string, string>()

    function getFilePath(toolName: string, args: any): string | undefined {
        if (toolName === "edit") return args.filePath
        if (toolName === "apply_patch") return args.path || args.filePath
        return undefined
    }

    return {
        "tool.execute.before": async (input, output) => {
            const toolName = input.tool?.toLowerCase()
            const isEditTool = toolName === "edit" || toolName === "apply_patch"
            if (!isEditTool) return

            const filePath = getFilePath(toolName, output.args)
            if (!filePath) return

            // Read-Before-Write Enforcement
            if (!readTracker.hasRead(input.sessionID, filePath) && existsSync(filePath)) {
                log("[edit-safeguard] REJECTED: Read-before-write violation", { filePath, sessionID: input.sessionID })
                throw new Error(
                    `[Edit Discipline Violation] Path REJECTED: ${filePath}\n` +
                    `You attempted to edit or patch a file that you have not read in the current session.\n` +
                    `The rule is path-specific: you MUST read the exact target file path before attempting to edit or overwrite it.\n` +
                    `Reading a different file or a grep snippet does not count.`
                )
            }

            try {
                if (existsSync(filePath)) {
                    const content = readFileSync(filePath, "utf-8")
                    backups.set(`${input.sessionID}:${input.callID}:${filePath}`, content)
                }
            } catch (err) {
                log("[edit-safeguard] Failed to create backup", { filePath, error: String(err) })
            }
        },

        "tool.execute.after": async (input, output) => {
            const toolName = input.tool?.toLowerCase()
            const isEditTool = toolName === "edit" || toolName === "apply_patch"
            if (!isEditTool) return

            const filePath = getFilePath(toolName, output.metadata?.args || {})
            if (!filePath) return

            const backupKey = `${input.sessionID}:${input.callID}:${filePath}`
            const originalContent = backups.get(backupKey)
            if (originalContent === undefined) return

            const resultOutput = (output.output ?? "").toLowerCase()
            const hasFailurePattern = FAILURE_PATTERNS.some(p => resultOutput.includes(p))
            
            let currentContent = ""
            try {
                currentContent = readFileSync(filePath, "utf-8")
            } catch (err) {
                // If file was deleted but it's a failure, we might want to restore
                if (hasFailurePattern) {
                    writeFileSync(filePath, originalContent)
                    log("[edit-safeguard] Restored deleted file after failed edit", { filePath })
                }
                return
            }

            const contentChanged = currentContent !== originalContent

            // Case 1: Failure pattern detected, but file was mutated (Partial Mutation)
            if (hasFailurePattern && contentChanged) {
                writeFileSync(filePath, originalContent)
                log("[edit-safeguard] Reverted partial mutation after " + resultOutput, { filePath })
                output.output += "\n\n[SAFEGUARD] Reverted partial mutation to prevent corruption."
            }

            // Case 2: Failure pattern detected - provide recovery instructions
            if (hasFailurePattern) {
                output.output += 
                    `\n\n**ACTION REQUIRED**: The edit or patch verification failed. This usually means the file content has drifted or the match block is incorrect.\n` +
                    `You MUST run 'read_file' (or equivalent) on '${filePath}' to synchronize your context with the real file contents, and then regenerate your edit/patch from the exact lines found in the file.`
                return
            }

            // Case 3: Edit claimed "success" or is silent, but we need to validate syntax
            if (!hasFailurePattern && contentChanged) {
                if (filePath.endsWith(".py")) {
                    const isValid = validatePythonSyntax(filePath)
                    if (!isValid) {
                        writeFileSync(filePath, originalContent)
                        log("[edit-safeguard] Reverted edit due to Python syntax error", { filePath })
                        throw new Error(`[edit-safeguard] Syntax validation failed for ${filePath}. Edit reverted to prevent corruption.`)
                    }
                }
            }

            // Cleanup backup
            backups.delete(backupKey)
        }
    }
}

function validatePythonSyntax(filePath: string): boolean {
    try {
        const result = spawnSync("python3", ["-m", "py_compile", filePath])
        return result.status === 0
    } catch (err) {
        log("[edit-safeguard] Syntax validation execution failed", { error: String(err) })
        return true // Fallback to allow if tool missing, though risky
    }
}
