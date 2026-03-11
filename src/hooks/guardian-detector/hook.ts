import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"

/**
 * Guardian Detector Hook
 * 
 * Monitors tool execution results and message transforms for fatal internal errors.
 * If a fatal error is detected in the "oh-my-opencode" namespace, it triggers
 * the Self-Healing flow.
 */

export function createGuardianDetectorHook(_ctx: PluginInput) {
    return {
        "tool.execute.after": async (input: any, output: any) => {
            if (output?.error && (output.error.includes("oh-my-opencode") || output.error.includes("Hook Error"))) {
                 log("[GuardianDetector] Fatal internal error detected in tool execution. Triggering self-healing check...");
                 // Trigger logic will go here
            }
        },
        "experimental.chat.messages.transform": async (_input: any, output: any) => {
             const hasInternalCrash = output.messages.some((m: any) => 
                m.parts.some((p: any) => p.type === "text" && (
                    p.text?.includes("[Transform Boundary Error]") ||
                    p.text?.includes("unhandled exception in message transform")
                ))
             );

             if (hasInternalCrash) {
                 log("[GuardianDetector] Fatal internal error detected in message transform. Triggering self-healing check...");
                 // Trigger logic will go here
             }
        }
    }
}
