// @ts-nocheck
import * as fs from "fs"
import * as path from "path"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { withToolContract } from "../../utils/tool-contract-wrapper"

export function createFsSafeTool(): any {
    return tool({
        description: "Safe, structured execution of filesystem writes. Returns verifiable status.",
        // @ts-ignore zod version mismatch against opencode-ai/plugin
        args: {
            operation: z.enum(["write", "delete", "mkdir"]).describe("The filesystem operation to perform."),
            filePath: z.string().describe("Absolute or relative path to the file/directory."),
            content: z.string().optional().describe("File content (only used if operation is 'write')."),
        },
        execute: withToolContract("fs_safe", async (args, context) => {
            try {
                const { operation, filePath, content } = args
                const contextDir = context.directory || process.cwd()
                const fullPath = path.resolve(contextDir, filePath)

                // 🚨 SECURITY: Repo Boundary & Symlink Guard
                if (!fullPath.startsWith(contextDir)) {
                    throw new Error(`Security Violation: Path escapes repository boundary (${filePath})`)
                }

                const parts = filePath.split(path.sep)
                let currentPath = contextDir
                for (const part of parts) {
                    if (!part || part === ".") continue
                    currentPath = path.join(currentPath, part)
                    try {
                        const stats = fs.lstatSync(currentPath)
                        if (stats.isSymbolicLink()) {
                            throw new Error(`Security Violation: Symlink detected at '${part}'. Symlinks are forbidden to prevent repo escape.`)
                        }
                    } catch (e) {
                        if (e.code !== "ENOENT") throw e
                        break // Path doesn't exist yet, which is fine for write/mkdir
                    }
                }

                let changedState = false
                let stateChangePayload: any = null

                if (operation === "write") {
                    const dir = path.dirname(fullPath)
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true })
                    }
                    fs.writeFileSync(fullPath, content || "", "utf8")
                    changedState = true
                    stateChangePayload = { type: "file.write", key: filePath, details: { fullPath } }
                }
                else if (operation === "delete") {
                    if (fs.existsSync(fullPath)) {
                        const stats = fs.statSync(fullPath)
                        if (stats.isDirectory()) {
                            fs.rmSync(fullPath, { recursive: true, force: true })
                        } else {
                            fs.unlinkSync(fullPath)
                        }
                        changedState = true
                        stateChangePayload = { type: "file.delete", key: filePath, details: { fullPath } }
                    }
                }
                else if (operation === "mkdir") {
                    if (!fs.existsSync(fullPath)) {
                        fs.mkdirSync(fullPath, { recursive: true })
                        changedState = true
                        stateChangePayload = { type: "command.execute", key: `mkdir ${filePath}`, details: { fullPath } }
                    }
                }

                const result = createSuccessResult({
                    verified: true,
                    changedState,
                    stateChange: stateChangePayload || undefined
                });

                context.metadata({
                    title: `fs ${operation}`,
                    ...result
                })

                return `Successfully executed ${operation} on ${filePath}`
            } catch (err: any) {
                const result = createFailureResult(`Failed: ${err.message}`);
                context.metadata({
                    title: `fs ${args.operation} error`,
                    ...result
                })

                return result.message
            }
        })
    })
}
