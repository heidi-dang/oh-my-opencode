import { createGitSafeTool } from "./git-safe";
import { createFsSafeTool } from "./fs-safe";
import { createVerifyTool } from "./verify";
import { createSubmitPlanTool, createMarkStepCompleteTool, createUnlockPlanTool } from "./plan";
import { createQueryLedgerTool } from "./query-ledger";
import { createCompleteTaskTool } from "./complete-task";

/**
 * Centralized Deterministic Tool Registry
 * 
 * Only tools registered here are allowed to be executed by the runtime.
 * This prevents agents from calling unauthorized or arbitrary commands.
 */

export const DETERMINISTIC_TOOLS: Record<string, () => any> = {
    "git_safe": createGitSafeTool,
    "fs_safe": createFsSafeTool,
    "verify_action": createVerifyTool,
    "submit_plan": createSubmitPlanTool,
    "mark_step_complete": createMarkStepCompleteTool,
    "unlock_plan": createUnlockPlanTool,
    "query_ledger": createQueryLedgerTool,
    "complete_task": createCompleteTaskTool
};

export function getToolFromRegistry(name: string) {
    const toolFactory = DETERMINISTIC_TOOLS[name];
    if (!toolFactory) {
        throw new Error(`[Tool Registry] Unsupported or unauthorized tool requested: ${name}`);
    }
    return toolFactory();
}
