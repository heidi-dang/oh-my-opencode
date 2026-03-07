// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { getIssueState, updateIssueState } from "../../features/issue-resolution/state"
import { isSessionIssueMode } from "../../features/claude-code-session-state"
import { createSuccessResult } from "../../utils/safety-tool-result"
import { storeToolMetadata } from "../../features/tool-metadata-store"
import { withToolContract } from "../../utils/tool-contract-wrapper"

export function createReportIssueVerificationTool(): any {
    return tool({
        name: "report_issue_verification",
        description: "Report progress on issue verification. Use this tool to permanently record that you have reproduced the issue, applied a fix, and verified the fix. Required before completing any issue-resolution task. Fields are additive, so you can report them one at a time as you proceed.",
        // @ts-ignore
        args: {
            reproduced: z.boolean().optional().describe("Set to true once you have successfully reproduced the issue live."),
            errorSignatureBefore: z.string().optional().describe("The exact error message, traceback, or symptom before the fix."),
            fixApplied: z.boolean().optional().describe("Set to true once you have applied a fix to the codebase."),
            reproAfterPassed: z.boolean().optional().describe("True if you re-ran the reproduction steps after the fix, and the issue is gone."),
            failureModeChecksPassed: z.boolean().optional().describe("Set to true if you checked nearby/related failure modes and they pass."),
        },
        execute: withToolContract("report_issue_verification", async (args, toolContext) => {
            const sessionID = toolContext.sessionID
            
            const newState = updateIssueState(sessionID, args)

            const result = createSuccessResult({
                verified: true,
                changedState: true,
                stateChange: newState,
                message: `Verification state updated.`
            });

            const meta = {
                title: "Issue Verification Update",
                ...result,
                sessionID,
                state: newState
            };

            toolContext.metadata(meta)

            if (toolContext.callID) {
                storeToolMetadata(sessionID, toolContext.callID, meta)
            }
            let response = `[VERIFICATION LOGGED]\n\nCurrent Verification State:\n- Reproduced: ${newState.reproduced}\n- Error Signature: ${newState.errorSignatureBefore ?? "None"}\n- Fix Applied: ${newState.fixApplied}\n- Repro After Fix Passed: ${newState.reproAfterPassed}\n- Nearby Checks Passed: ${newState.failureModeChecksPassed}\n\n`
            
            if (isSessionIssueMode(sessionID)) {
                response += `Note: You are in Strict Issue Resolution Mode. 'reproduced', 'fixApplied', and 'reproAfterPassed' MUST be true to complete this task.`
            }

            return response
        })
    })
}
