// @ts-nocheck
// @ts-nocheck
import { spawn } from "bun"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { VERIFICATION_COMMANDS } from "../../agents/runtime/verify-action"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"

export function createVerifyTool(): any {
    return tool({
        description: "Centrally verifies system state changes. Required before claiming success.",
        // @ts-ignore
        args: {
            action: z.enum(Object.keys(VERIFICATION_COMMANDS) as [string, ...string[]]).describe("The predefined verification action to perform."),
            context: z.record(z.string(), z.any()).optional().describe("Context variables needed for the command (e.g., { BRANCH: 'feature-1' })"),
        },
        execute: async (args, toolContext) => {
            const actionKey = args.action as keyof typeof VERIFICATION_COMMANDS
            const config = VERIFICATION_COMMANDS[actionKey]

            if (!config || !config.command) {
                const result = createFailureResult(`Unknown verification action or missing command: ${args.action}`);
                toolContext.metadata({ title: "Verify Error", ...result })
                return result.message
            }

            // Replace ${VAR} in command template with provided context
            let cmdString = config.command
            if (args.context) {
                for (const [key, value] of Object.entries(args.context)) {
                    cmdString = cmdString.replace(`\${${key}}`, String(value))
                }
            }

            try {
                const commandArgs = cmdString.split(" ")
                const proc = spawn(commandArgs, {
                    cwd: toolContext.directory || process.cwd(),
                    stdout: "pipe",
                    stderr: "pipe"
                })

                const stdoutText = await new Response(proc.stdout).text()
                const exitCode = await proc.exited

                let isSuccess = false
                if (config.successCondition === 'output === "0"') {
                    isSuccess = stdoutText.trim() === "0"
                } else if (config.successCondition === 'exit code === 0') {
                    isSuccess = exitCode === 0
                } else if (config.successCondition === 'output starts with "https://"') {
                    isSuccess = stdoutText.trim().startsWith("https://")
                } else if (config.successCondition === 'output is empty') {
                    isSuccess = stdoutText.trim() === ""
                } else {
                    isSuccess = exitCode === 0
                }

                const result = createSuccessResult({
                    verified: isSuccess,
                    changedState: false,
                    message: isSuccess ? undefined : config.failureMessage
                });

                toolContext.metadata({
                    title: `Verify: ${config.name}`,
                    ...result
                })

                return isSuccess
                    ? `Verification SUCCESS. (Output: ${stdoutText.trim()})`
                    : `Verification FAILED. ${config.failureMessage} (Output: ${stdoutText.trim()})`
            } catch (e: any) {
                const result = createFailureResult(`Execution failed: ${e.message}`);
                toolContext.metadata({ title: `Verify Error`, ...result })
                return result.message
            }
        }
    })
}
