// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { ledger } from "../../runtime/state-ledger"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { storeToolMetadata } from "../../features/tool-metadata-store"
import { isSessionIssueMode } from "../../features/claude-code-session-state"
import { getIssueState } from "../../features/issue-resolution/state"
import { withToolContract } from "../../utils/tool-contract-wrapper"

export function createCompleteTaskTool(): any {
    return tool({
        description: "Signal that the task is complete. The runtime will compose the final verified state report. DO NOT output your own summary, just call this tool.",
        // @ts-ignore
        args: {
            message: z.string().describe("Optional short note about what was done. Do not include PR URLs or commit hashes here.")
        },
        execute: withToolContract("complete_task", async (args, toolContext) => {
            const sessionID = toolContext.sessionID
            
            if (isSessionIssueMode(sessionID)) {
                const issueState = getIssueState(sessionID)
                if (!issueState.reproduced || !issueState.fixApplied || !issueState.reproAfterPassed) {
                    const failMsg = `[ERROR] STRICT ISSUE RESOLUTION MODE ACTIVE.\n\nYou cannot mark this task as complete until you have explicitly verified the fix.\n\nCurrent Verification State:\n- Reproduced: ${issueState.reproduced}\n- Fix Applied: ${issueState.fixApplied}\n- Repro After Fix Passed: ${issueState.reproAfterPassed}\n\nYou MUST use the 'report_issue_verification' tool to truthfully log your progress as you perform each step. If you only performed static reasoning without live verification, your state is incomplete.`
                    
                    const result = createFailureResult(failMsg)
                    const meta = { title: "Task Completion Rejected", ...result }
                    toolContext.metadata(meta)
                    if (toolContext.callID) {
                        storeToolMetadata(toolContext.sessionID, toolContext.callID, meta)
                    }

                    return failMsg
                }
            }

            // Filter strictly: verified, successful, state changes, and only in THIS session flow
            const entries = ledger.getEntries().filter(e =>
                e.verified === true &&
                e.success === true &&
                e.changedState === true &&
                (!e.sessionID || e.sessionID === toolContext.sessionID)
            )

            // Compile verifiable evidence report
            let report = `TASK COMPLETE.\n\nRuntime Verified Actions (Current Flow):\n`
            if (entries.length === 0) {
                report += "- No state changes recorded in this session.\n"
            } else {
                for (const entry of entries) {
                    report += `- [${entry.type}] ${entry.key}\n`
                }
            }

            if (args.message) {
                report += `\nAgent Note: ${args.message}\n`
            }

            const result = createSuccessResult({
                verified: true,
                changedState: false,
                message: args.message
            });

            const meta = {
                title: "Task Completed",
                ...result,
                sessionID: toolContext.sessionID,
                entries: entries.length
            };

            toolContext.metadata(meta)

            if (toolContext.callID) {
                storeToolMetadata(toolContext.sessionID, toolContext.callID, meta)
            }

            return `[RUNTIME AUTHORIZATION]\n\n${report}\n\nYou may now conclude your response using EXACTLY this report as your final output.`
        })
    })
}
