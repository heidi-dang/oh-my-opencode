// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { ledger } from "../state-ledger"
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result"
import { isSessionIssueMode } from "../../features/claude-code-session-state"
import { getIssueState } from "../../features/issue-resolution/state"
import { withToolContract } from "../../utils/tool-contract-wrapper"
import { normalizeSDKResponse } from "../../shared/normalize-sdk-response"

export function createCompleteTaskTool(options?: { client?: any, backgroundManager?: any }): any {
    return tool({
        description: "Signal that the task is complete. The runtime will compose the final verified state report. DO NOT output your own summary, just call this tool.",
        // @ts-ignore
        args: {
            message: z.string().describe("Optional short note about what was done. Do not include PR URLs or commit hashes here."),
            overrideStrict: z.boolean().optional().describe("If true, attempts to complete even if strict mode requirements are not fully met (requires verification_summary)."),
            verification_summary: z.string().optional().describe("Summary of manual verification performed to justify completion.")
        },
        execute: withToolContract("complete_task", async (args, toolContext) => {
            const client = options?.client;
            const sessionID = toolContext.sessionID;
            
            // 1. Check for incomplete todos
            if (client) {
                try {
                    const todosRes = await client.session.todo({
                        path: { id: sessionID }
                    })
                    const todos = normalizeSDKResponse(todosRes, [])
                    const incompleteTodos = todos.filter(
                        (t: any) => t.status !== "completed" && t.status !== "cancelled" && t.status !== "blocked" && t.status !== "deleted"
                    )

                    if (incompleteTodos.length > 0 && !args.overrideStrict) {
                        const failMsg = `[ERROR] TASK COMPLETION REJECTED.\n\nYou have ${incompleteTodos.length} incomplete TODOs remaining. You CANNOT mark the task as complete until all TODOs are explicitly marked as completed or cancelled. Use 'overrideStrict: true' only if these TODOs are irrelevant to the final state.`
                        
                        const result = createFailureResult(failMsg)
                        toolContext.metadata({ title: "Task Completion Rejected", ...result })
                        return failMsg
                    }
                } catch (e) {}
            }
            
            // 2. Strict Issue Resolution Mode Check
            if (isSessionIssueMode(sessionID)) {
                const issueState = getIssueState(sessionID)
                const isFullyVerified = issueState.reproduced && issueState.fixApplied && issueState.reproAfterPassed;
                
                if (!isFullyVerified && !(args.overrideStrict && args.verification_summary)) {
                    const failMsg = `[ERROR] STRICT ISSUE RESOLUTION MODE ACTIVE.\n\nYou cannot mark this task as complete until you have explicitly verified the fix.\n\nCurrent Verification State:\n- Reproduced: ${issueState.reproduced}\n- Fix Applied: ${issueState.fixApplied}\n- Repro After Fix Passed: ${issueState.reproAfterPassed}\n\nTo bypass this (e.g., if repro is impossible but fix is verified), use 'overrideStrict: true' and provide a detailed 'verification_summary'.`
                    
                    const result = createFailureResult(failMsg)
                    toolContext.metadata({ title: "Task Completion Rejected", ...result })
                    return failMsg
                }
            }

            // Filter strictly: verified, successful, state changes, and only in THIS session flow
            const descendantSessions = options?.backgroundManager?.getAllDescendantTasks 
                ? options.backgroundManager.getAllDescendantTasks(toolContext.sessionID).map((t: any) => t.sessionID).filter(Boolean)
                : [];
            const sessionIDs = [toolContext.sessionID, ...descendantSessions];

            const entries = ledger.getEntries().filter(e =>
                e.verified === true &&
                e.success === true &&
                e.sessionID && // 🚨 SECURITY: Fix B4 - Require sessionID
                sessionIDs.includes(e.sessionID)
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

            toolContext.metadata({
                title: "Task Completed",
                ...result,
                sessionID: toolContext.sessionID,
                entries: entries.length
            })

            return `[RUNTIME AUTHORIZATION]\n\n${report}\n\nYou may now conclude your response using EXACTLY this report as your final output.`
        })
    })
}
