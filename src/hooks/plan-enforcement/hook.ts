import type { PluginInput } from "@opencode-ai/plugin"
import { compiler } from "../../runtime/plan-compiler"

/**
 * Plan Enforcement Guard
 * 
 * If the Plan Compiler has an active DAG step, the agent is strictly forbidden
 * from taking actions that deviate from the current step's intent.
 * 
 * NOTE: For full robust enforcement, we would map the `activeStep.action` 
 * to a strict whitelist of permitted tools. Here we provide a foundational
 * enforcement layer that warns the agent to stay on track.
 */

export function createPlanEnforcementHook(_ctx: PluginInput) {
    return {
        "tool.execute.before": async (
            input: { tool: string; sessionID: string; callID: string },
            _output: { args: any }
        ) => {
            const activeStep = compiler.getActiveStep()
            if (!activeStep) return // No active plan, agent is in freestyle mode

            // Allow the agent to mark the step as complete
            if (input.tool === "mark_step_complete" || input.tool === "verify_action") {
                return
            }

            // Check if the current tool being called is completely unrelated to the active step
            // Simple heuristic for demonstration:
            const actionMatchesTool =
                activeStep.action.toLowerCase().includes(input.tool.replace("_safe", "")) ||
                input.tool.includes(activeStep.action.toLowerCase().split("_")[0] || "")

            if (!actionMatchesTool) {
                // Enforce the plan!
                throw new Error(
                    `[Plan Compiler Guard] Action Rejected.\n` +
                    `You are currently bound by the deterministic execution plan.` +
                    `\nActive Step: ${activeStep.action} (ID: ${activeStep.id})` +
                    `\nAttempted Tool: ${input.tool}` +
                    `\n\nYou must focus solely on completing the active step, then call 'mark_step_complete'.`
                )
            }
        }
    }
}
