// @ts-nocheck
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { compiler } from "../plan-compiler"
import { createSuccessResult } from "../../utils/safety-tool-result"

export function createSubmitPlanTool(): any {
    return tool({
        description: "Submits a deterministic execution plan. The Runtime Compiler will take over and guide you strictly through the resulting dependency graph.",
        // @ts-ignore zod version mismatch against opencode-ai/plugin
        args: {
            steps: z.array(z.object({
                id: z.string().describe("Unique step ID (e.g. 'step1')"),
                action: z.string().describe("The high-level action (e.g. 'run_tests', 'fix_linter', 'commit')"),
                dependencies: z.array(z.string()).describe("IDs of steps that must complete before this one")
            })).describe("The execution DAG (Directed Acyclic Graph) of operations")
        },
        execute: async (args, toolContext) => {
            const taskID = compiler.submit(toolContext.sessionID, args.steps)

            const result = createSuccessResult({
                verified: true,
                changedState: false,
                metadata: { planLength: args.steps.length, taskID }
            });

            toolContext.metadata({
                title: "Plan Submitted",
                ...result
            })

            const active = compiler.getActiveStep(toolContext.sessionID)
            return `Plan successfully compiled into an executable graph (including implicit verification nodes).\n\nCURRENT FORCED STEP: ${active?.action} (ID: ${active?.id}).\nDo not execute any other tools until this step is complete.`
        }
    })
}

export function createMarkStepCompleteTool(): any {
    return tool({
        description: "Marks the current forced execution step as complete and retrieves the next step.",
        // @ts-ignore zod version mismatch against opencode-ai/plugin
        args: {
            id: z.string().describe("The ID of the step that was completed")
        },
        execute: async (args, toolContext) => {
            compiler.markStepComplete(toolContext.sessionID, args.id)

            const result = createSuccessResult({
                verified: true,
                changedState: false,
                metadata: { stepId: args.id }
            });

            toolContext.metadata({
                title: `Step ${args.id} Complete`,
                ...result
            })

            const active = compiler.getActiveStep(toolContext.sessionID)
            if (!active) {
                return `Step ${args.id} marked complete. The plan graph is now fully exhausted. You may report final success to the user.`
            }

            return `Step ${args.id} marked complete.\n\nNEXT FORCED STEP: ${active.action} (ID: ${active.id}).`
        }
    })
}

export function createUnlockPlanTool(): any {
    return tool({
        description: "Manually unlocks the deterministic execution plan, clearing any active steps for the current session.",
        args: {},
        execute: async (_, toolContext) => {
            compiler.clear(toolContext.sessionID)
            
            const result = createSuccessResult({
                verified: true,
                changedState: false
            })

            toolContext.metadata({
                title: "Plan Unlocked",
                ...result
            })

            return "The deterministic execution plan has been cleared for this session. You are now in freestyle mode."
        }
    })
}
