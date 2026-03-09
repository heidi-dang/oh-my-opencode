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

    // Shell and execution access
    "interactive_bash",
    "bash",
    "apply_patch",
    "hashline_edit",
    "ast_grep_search",
    "ls",
    "read_file",
    "find_files",
    "unlock_plan",

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
            
            // If no active plan, we are in freestyle or bootstrap mode
            if (!activeStep) {
                // If the tool is one that usually requires a plan, we might want to bootstrap
                return
            }

            // Always allow essential tools
            if (ALWAYS_ALLOWED_TOOLS.has(input.tool)) {
                return
            }

            // Recovery mode allows wider access to fix things
            if (activeStep.mode === "recovery") {
                const recoveryTools = new Set(["edit", "write", "apply_patch", "interactive_bash", "bash"])
                if (recoveryTools.has(input.tool)) {
                    return
                }
            }

            // STALE STATE / MISMATCH DETECTION
            const isStaleLock = 
                (Date.now() - activeStep.lastTouch > 5 * 60 * 1000) || // 5 min timeout
                ((input.tool === "todowrite" || input.tool === "task" || input.tool === "submit_plan") &&
                 !activeStep.action.toLowerCase().includes(input.tool.replace("_safe", "").replace("_create", "")))

            const actionMatchesTool =
                activeStep.action.toLowerCase().includes(input.tool.replace("_safe", "")) ||
                input.tool.includes(activeStep.action.toLowerCase().split("_")[0] || "")

            if (isStaleLock || !actionMatchesTool) {
                const recoveryCount = compiler.incrementRecoveryAttempts(input.sessionID)
                
                if (recoveryCount > 3) {
                    throw new Error(`[Plan Governor] Recovery limit exceeded (3 attempts). Manual intervention required. The agent is stuck in a replanning loop.`)
                }

                const reason = isStaleLock ? "Stale lock/Timeout" : "Tool mismatch"
                console.log(`[Plan Compiler Guard] ${reason} detected (Attempt ${recoveryCount}). Transitioning to recovery.`, {
                    sessionID: input.sessionID,
                    activeStep: activeStep.id,
                    requestedTool: input.tool
                })

                // ATOMIC RECOVERY TRANSITION
                compiler.setMode(input.sessionID, "recovery")
                // etc...
                
                // 2. Build recovery context/prompt
                const recoveryPrompt = `
[Plan Governor] Plan drift detected during step '${activeStep.id}' (${activeStep.action}).
The requested tool '${input.tool}' does not match the active plan intent.

Current Status:
- Original Goal: still active
- Repo State: partially modified
- Last Action: ${activeStep.action}

RECOVERY INSTRUCTIONS:
1. Re-evaluate the current state of the repository.
2. If the previous plan is still valid but the steps were too narrow, generate a micro-replan.
3. If the plan is no longer valid, submit a full replacement plan via 'submit_plan'.
4. Continue toward the user's original goal.

Do not block. Forward motion is required.`

                // 3. Inject recovery signal (we do this by throwing a specific "Retry" error that the SDK handles, 
                // or by returning a message that the agent reads as its next input. 
                // In OpenCode, throwing an error with instructions is a common pattern for "Correction").
                
                throw new Error(recoveryPrompt)
            }
        }
    }
}
