// @ts-nocheck
import { spawn } from "bun"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { withToolContract } from "../../utils/tool-contract-wrapper"
import { updatePRState } from "../../features/pr-state/storage"

export function createGhSafeTool(): any {
    return tool({
        description: "Safe, structured execution of GitHub CLI (gh) commands. Returns verifiable status.",
        // @ts-ignore zod version mismatch against opencode-ai/plugin
        args: {
            command: z.string().describe("The gh command without the 'gh ' prefix (e.g. 'pr create --title \"...\" --body \"...\"')"),
        },
        execute: withToolContract("gh_safe", async (args: any, context) => {
            let commandArgs: string[] = []
            try {
                commandArgs = (args.command as string).match(/([^\\"]\S*|".+?")\s*/g)?.map((s: string) => s.trim().replace(/^"(.*)"$/, '$1')) || []

                if (commandArgs.length === 0) {
                    const result = createFailureResult("No command provided");
                    context.metadata({ title: "GH Exec Error", ...result })
                    return result.message
                }

                const proc = spawn(["gh", ...commandArgs], {
                    cwd: context.directory || process.cwd(),
                    stdout: "pipe",
                    stderr: "pipe"
                })

                const stdoutText = await new Response(proc.stdout).text()
                const stderrText = await new Response(proc.stderr).text()
                const exitCode = await proc.exited

                const success = exitCode === 0

                // Detect PR creation from output
                let prURL = "";
                if (success && commandArgs[0] === "pr" && commandArgs[1] === "create") {
                    // Typical output: "https://github.com/user/repo/pull/123"
                    const match = stdoutText.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/);
                    if (match) {
                        prURL = match[0];
                        const prNumber = parseInt(prURL.split("/").pop() || "0");
                        updatePRState(context.sessionID, {
                            url: prURL,
                            number: prNumber,
                            status: "open"
                        });
                    }
                }

                // Detect PR merge
                if (success && commandArgs[0] === "pr" && commandArgs[1] === "merge") {
                    updatePRState(context.sessionID, {
                        status: "merged"
                    });
                }

                const isStateChanging = ["pr", "issue", "branch", "repo"].includes(commandArgs[0])
                const result = createSuccessResult({
                    verified: !isStateChanging,
                    changedState: success && isStateChanging,
                    stateChange: prURL ? { type: "git.pr", key: prURL, details: { url: prURL } } : undefined
                });

                context.metadata({
                    title: `gh ${commandArgs[0]} ${commandArgs[1] || ""}`,
                    ...result
                })

                return `Exit Code: ${exitCode}\n\nSTDOUT:\n${stdoutText}\n\nSTDERR:\n${stderrText}`
            } catch (e: any) {
                const result = createFailureResult(`Execution failed: ${e.message}`);
                context.metadata({ title: "GH Exec Error", ...result })
                return result.message
            }
        })
    })
}
