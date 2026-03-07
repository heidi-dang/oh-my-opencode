import { existsSync, readFileSync, writeFileSync } from "fs"
import { spawnSync } from "child_process"
import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

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
    "oldstring and newstring must be different"
]

export function createEditSafeguardHook(ctx: PluginInput): Hooks {
    const backups = new Map<string, string>()

    return {
        "tool.execute.before": async (input, output) => {
            const toolName = input.tool?.toLowerCase()
            if (toolName !== "edit") return

            const args = output.args as { filePath?: string }
            const filePath = args.filePath
            if (!filePath) return

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
            if (toolName !== "edit") return

            const args = output.metadata?.args as { filePath?: string }
            const filePath = args?.filePath
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
                return
            }

            // Case 2: Edit claimed "success" or is silent, but we need to validate syntax
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
