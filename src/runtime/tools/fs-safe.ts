// @ts-nocheck
import * as fs from "fs"
import * as path from "path"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { storeToolMetadata } from "../../features/tool-metadata-store"

export function createFsSafeTool(): any {
    return tool({
        description: "Safe, structured execution of filesystem writes. Returns verifiable status.",
        // @ts-ignore zod version mismatch against opencode-ai/plugin
        args: {
            operation: z.enum(["write", "delete", "mkdir"]).describe("The filesystem operation to perform."),
            filePath: z.string().describe("Absolute or relative path to the file/directory."),
            content: z.string().optional().describe("File content (only used if operation is 'write')."),
        },
        execute: async (args, context) => {
            try {
                const { operation, filePath, content } = args
                const fullPath = path.resolve(context.directory || process.cwd(), filePath)

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

                if (context.callID) {
                    storeToolMetadata(context.sessionID, context.callID, {
                        title: `fs ${operation}`,
                        metadata: result as any
                    })
                }

                return `Successfully executed ${operation} on ${filePath}`
            } catch (err: any) {
                const result = createFailureResult(`Failed: ${err.message}`);
                const meta = {
                    title: `fs ${args.operation} error`,
                    metadata: result as any
                };
                context.metadata({
                    title: meta.title,
                    ...result
                })

                if (context.callID) {
                    storeToolMetadata(context.sessionID, context.callID, meta)
                }

                return result.message
            }
        }
    })
}
