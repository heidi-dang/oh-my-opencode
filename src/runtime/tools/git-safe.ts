import { spawn } from "bun"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

export const createGitSafeTool = () => tool({
    description: "Safe, structured execution of git commands. Returns verifiable status.",
    // @ts-ignore zod version mismatch against opencode-ai/plugin
    args: {
        command: z.string().describe("The git command without the 'git ' prefix (e.g. 'commit -m \"msg\"', 'push origin main')"),
    },
    execute: async (args: any, context) => {
        let commandArgs: string[] = []
        try {
            commandArgs = (args.command as string).match(/([^\\"]\S*|".+?")\s*/g)?.map((s: string) => s.trim().replace(/^"(.*)"$/, '$1')) || []
        } catch (e) {
            context.metadata({ title: "Git Exec Error", metadata: { success: false, changedState: false } })
            return "JSON parse error on args"
        }

        if (commandArgs.length === 0) {
            context.metadata({ title: "Git Exec Error", metadata: { success: false, changedState: false } })
            return "No command provided"
        }

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

        context.metadata({
            title: `git ${commandArgs[0]}`,
            metadata: {
                success,
                changedState,
                ...(stateChangePayload && { stateChange: stateChangePayload })
            }
        })

        return `Exit Code: ${exitCode}\n\nSTDOUT:\n${stdoutText}\n\nSTDERR:\n${stderrText}`
    }
})
