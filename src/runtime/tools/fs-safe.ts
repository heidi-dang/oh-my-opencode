import * as fs from "fs"
import * as path from "path"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

export const createFsSafeTool = () => tool({
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

            context.metadata({
                title: `fs ${operation}`,
                metadata: {
                    success: true,
                    changedState,
                    ...(stateChangePayload && { stateChange: stateChangePayload })
                }
            })

            return `Successfully executed ${operation} on ${filePath}`
        } catch (err: any) {
            context.metadata({
                title: `fs ${args.operation} error`,
                metadata: { success: false, changedState: false }
            })
            return `Failed: ${err.message}`
        }
    }
})
