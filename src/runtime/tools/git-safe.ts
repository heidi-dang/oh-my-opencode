// @ts-nocheck
import { spawn as bunSpawn } from "bun"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { withToolContract } from "../../utils/tool-contract-wrapper"

export function createGitSafeTool(deps: { spawn?: typeof bunSpawn } = {}): any {
    const spawn = deps.spawn || bunSpawn
    return tool({
        description: "Safe, structured execution of git commands. Returns verifiable status.",
        // @ts-ignore zod version mismatch against opencode-ai/plugin
        args: {
            command: z.string().describe("The git command without the 'git ' prefix (e.g. 'commit -m \"msg\"', 'push origin main')"),
        },
        execute: withToolContract("git_safe", async (args: any, context) => {
            let commandArgs: string[] = []
            try {
                // 🚨 SECURITY: Safe Argument Parsing (Fix B3)
                const rawCommand = (args.command as string).trim()
                commandArgs = rawCommand.match(/(".*?"|'.*?'|\S+)/g)?.map(s => s.replace(/^["']|["']$/g, "")) || []
                
                if (commandArgs.length === 0) {
                    throw new Error("Empty git command provided")
                }

                // 🚨 SECURITY: Dangerous Command Blacklist (Fix B2/G2)
                const DANGEROUS_FLAGS = ["--force", "-f", "--force-with-lease", "--force-if-includes", "filter-branch", "reflog", "rebase --quit", "reset --hard HEAD~"]
                const destructiveClean = commandArgs[0] === "clean" && commandArgs.some(arg => arg === "-f" || arg === "-df" || arg === "-fd" || arg === "-xf" || arg === "-fx")

                if (DANGEROUS_FLAGS.some(flag => rawCommand.includes(flag)) || destructiveClean) {
                    throw new Error(`Security Violation: Dangerous git flag or command detected and blocked: ${rawCommand}`)
                }
            } catch (e: any) {
                const result = createFailureResult(e.message)
                context.metadata({ title: "Git Safety Violation", ...result })
                return result.message
            }

            try {
                const proc = spawn(["git", ...commandArgs], {
                    cwd: context.directory || process.cwd(),
                    stdout: "pipe",
                    stderr: "pipe"
                })

                const stdoutText = await new Response(proc.stdout).text()
                const stderrText = await new Response(proc.stderr).text()
                const exitCode = await proc.exited

                const success = exitCode === 0

                // Determine state change based on command
                const isPush = commandArgs[0] === "push"
                const isCommit = commandArgs[0] === "commit"
                const isStateChanging = ["commit", "push", "checkout", "branch", "rebase", "merge", "reset", "revert", "clean", "rm", "add"].includes(commandArgs[0])
                const changedState = success && isStateChanging

                // Format Ledger Payload
                let stateChangePayload = null
                if (changedState) {
                    if (isPush) stateChangePayload = { type: "git.push", key: "origin", details: { exitCode } }
                    else if (isCommit) stateChangePayload = { type: "git.commit", key: "HEAD", details: { exitCode } }
                    else stateChangePayload = { type: "command.execute", key: `git ${commandArgs[0]}`, details: { exitCode } }
                }

                // 1. Proactive Verification
                let verified = success
                if (success && isStateChanging) {
                    if (commandArgs[0] === "checkout") {
                        // Verify branch change or head movement
                        const statusProc = spawn(["git", "status", "--porcelain", "-b"], { cwd: context.directory || process.cwd(), stdout: "pipe" })
                        const statusText = await new Response(statusProc.stdout).text()
                        const target = commandArgs[commandArgs.length - 1]
                        verified = statusText.includes(target) || statusText.includes("HEAD detached")
                    } else if (commandArgs[0] === "add") {
                        // Verify something is staged
                        const diffProc = spawn(["git", "diff", "--cached", "--name-only"], { cwd: context.directory || process.cwd(), stdout: "pipe" })
                        const diffText = await new Response(diffProc.stdout).text()
                        verified = diffText.trim().length > 0
                    } else if (commandArgs[0] === "fetch") {
                        // Fetch success is enough for verification
                        verified = true
                    }
                }

                const result = createSuccessResult({
                    verified,
                    changedState,
                    stateChange: stateChangePayload || undefined
                });

                context.metadata({
                    title: `git ${commandArgs[0]}`,
                    ...result
                })

                return `Exit Code: ${exitCode}\n\nSTDOUT:\n${stdoutText}\n\nSTDERR:\n${stderrText}`
            } catch (e: any) {
                const result = createFailureResult(`Git execution failed: ${e.message}`);
                context.metadata({ title: "Git Exec Error", ...result })
                return result.message
            }
        })
    })
}
