import type { PluginInput } from "@opencode-ai/plugin"
import { compiler } from "../../runtime/plan-compiler"

/**
 * Custom error for Plan Compiler Guard rejections
 */
export class PlanCompilerGuardError extends Error {
    constructor(
        message: string,
        public readonly activeStepId: string,
        public readonly activeStepAction: string,
        public readonly requestedTool: string,
        public readonly allowedTools: string[],
        public readonly reason: string
    ) {
        super(message)
        this.name = "PlanCompilerGuardError"
    }
}

/**
 * Tools that are always allowed during any active plan step.
 * These are essential for basic execution, reading, writing, task management, and diagnostics.
 */
const ALWAYS_ALLOWED_TOOLS = new Set([
    // Plan management
    "mark_step_complete",
    "verify_action",
    "submit_plan",
    "query_ledger",
    "complete_task",

    // Reading/searching
    "grep",
    "glob",
    "ast_grep",
    "lsp_symbols",
    "lsp_goto_definition",
    "lsp_find_references",

    // Writing/editing
    "edit",
    "lsp_rename",
    "lsp_prepare_rename",
    "fs_safe",
    "git_safe",

    // Task management
    "task_create",
    "task_get",
    "task_list",
    "task_update",
    "task",

    // Diagnostics/testing
    "lsp_diagnostics",
    "background_output",
    "background_cancel",

    // Shell access
    "interactive_bash",

    // Agent communication
    "call_omo_agent",
    "skill",
    "skill_mcp",

    // Session management
    "session_manager_create",
    "session_manager_list",
    "session_manager_switch",

    // Multimodal
    "look_at",
])

/**
 * Plan Enforcement Guard
 * 
 * If the Plan Compiler has an active DAG step, the agent is strictly forbidden
 * from taking actions that deviate from the current step's intent.
 * 
 * Essential tools for execution are always allowed regardless of the step.
 */

export function createPlanEnforcementHook(_ctx: PluginInput) {
    return {
        "tool.execute.before": async (
            input: { tool: string; sessionID: string; callID: string },
            _output: { args: any }
        ) => {
            const activeStep = compiler.getActiveStep(input.sessionID)
            if (!activeStep) return // No active plan, agent is in freestyle mode

            // Always allow essential tools
            if (ALWAYS_ALLOWED_TOOLS.has(input.tool)) {
                return
            }

            // STALE STATE AUTO-RECOVERY
            const isStaleLock =
                (input.tool === "todowrite" || input.tool === "task" || input.tool === "read" || input.tool === "task_create" || input.tool === "submit_plan") &&
                !activeStep.action.toLowerCase().includes(input.tool.replace("_safe", "").replace("_create", ""))

            if (isStaleLock) {
                console.warn(`[Plan Compiler Guard] Stale lock detected in session ${input.sessionID} (Tool: ${input.tool}). Auto-clearing plan.`)
                compiler.clear(input.sessionID)
                return
            }

            const actionMatchesTool =
                activeStep.action.toLowerCase().includes(input.tool.replace("_safe", "")) ||
                input.tool.includes(activeStep.action.toLowerCase().split("_")[0] || "")

            if (!actionMatchesTool) {
                // Log the guard decision
                console.log(`[Plan Compiler Guard] Blocking tool call`, {
                    activeStepId: activeStep.id,
                    activeStepAction: activeStep.action,
                    requestedTool: input.tool,
                    allowedTools: Array.from(ALWAYS_ALLOWED_TOOLS),
                    reason: "Tool does not match active step intent and is not in always-allowed list"
                })

                // Enforce the plan!
                throw new PlanCompilerGuardError(
                    `[Plan Compiler Guard] Action Rejected.\n` +
                    `Active Step: ${activeStep.action} (ID: ${activeStep.id})\n` +
                    `Current Tool: ${input.tool}\n\n` +
                    `You are currently locked into a deterministic plan. You MUST finish the active step ` +
                    `or use 'mark_step_complete' if the work is done. If you need to break out of this plan, ` +
                    `use 'unlock_plan' or complete all steps.\n\n` +
                    `**RECOVERY**: If you believe this is a stale lock or the plan is no longer valid, ` +
                    `you MUST run 'unlock_plan' now to return to freestyle mode.`,
                    activeStep.id,
                    activeStep.action,
                    input.tool,
                    Array.from(ALWAYS_ALLOWED_TOOLS),
                    "Tool mismatch"
                )
            }
        }
    }
}
