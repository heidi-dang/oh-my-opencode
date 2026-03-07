import { createFsSafeTool } from "../../../runtime/tools/fs-safe"
import { createGitSafeTool } from "../../../runtime/tools/git-safe"
import { createSubmitPlanTool, createMarkStepCompleteTool, createUnlockPlanTool } from "../../../runtime/tools/plan"
import { createVerifyTool } from "../../../runtime/tools/verify"
import { createQueryLedgerTool } from "../../../runtime/tools/query-ledger"
import { createCompleteTaskTool } from "../../../runtime/tools/complete-task"
import { storeToolMetadata, clearPendingStore, consumeToolMetadata } from "../../../features/tool-metadata-store"
import type { CheckResult, DoctorIssue } from "../types"

/**
 * Tool Contract Compliance Check
 * 
 * Verifies that all safety-critical tools return the required structured 
 * boolean metadata (success, verified) via storeToolMetadata.
 */

export async function checkToolContract(): Promise<CheckResult> {
    const issues: DoctorIssue[] = []
    
    const toolsToTest = [
        { name: "fs_safe", factory: createFsSafeTool, args: { operation: "read", filePath: "non-existent-test-file" } },
        { name: "git_safe", factory: createGitSafeTool, args: { command: "status" } },
        { name: "submit_plan", factory: createSubmitPlanTool, args: { steps: [] } },
        { name: "mark_step_complete", factory: createMarkStepCompleteTool, args: { id: "step1" } },
        { name: "unlock_plan", factory: createUnlockPlanTool, args: {} },
        { name: "verify_action", factory: createVerifyTool, args: { action: "LS_FILES" } },
        { name: "query_ledger", factory: createQueryLedgerTool, args: {} },
        { name: "complete_task", factory: createCompleteTaskTool, args: { message: "test completion" } },
    ]

    for (const toolSpec of toolsToTest) {
        try {
            const tool = toolSpec.factory()
            const sessionID = `doctor-test-${Date.now()}`
            const callID = `call-${toolSpec.name}`
            
            clearPendingStore()
            
            const mockContext = {
                sessionID,
                callID,
                directory: process.cwd(),
                metadata: () => {},
                client: {} as any
            }

            // Execute tool (we don't care about result, only metadata storage)
            await tool.execute(toolSpec.args, mockContext).catch(() => {})

            const stored = consumeToolMetadata(sessionID, callID)
            if (!stored || !stored.metadata) {
                issues.push({
                    title: `Tool Contract Violation: ${toolSpec.name}`,
                    description: `Tool did not call storeToolMetadata or returned no metadata.`,
                    severity: "error",
                    affects: [toolSpec.name]
                })
                continue
            }

            const meta = stored.metadata as any
            if (typeof meta.success !== 'boolean' || typeof meta.verified !== 'boolean') {
                issues.push({
                    title: `Tool Contract Violation: ${toolSpec.name}`,
                    description: `Tool metadata missing 'success' or 'verified' booleans. Found: ${JSON.stringify(meta)}`,
                    severity: "error",
                    affects: [toolSpec.name]
                })
            }
        } catch (e: any) {
            issues.push({
                title: `Doctor internal error testing ${toolSpec.name}`,
                description: e.message,
                severity: "warning"
            })
        }
    }

    return {
        name: "Tool Contract Compliance",
        status: issues.length === 0 ? "pass" : "fail",
        message: issues.length === 0 
            ? "All safety tools comply with the result contract." 
            : `${issues.length} tool contract violation(s) detected.`,
        details: toolsToTest.map(t => `${t.name}: tested`),
        issues
    }
}
