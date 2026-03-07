import type { PluginInput } from "@opencode-ai/plugin"
import type { RunStateWatchdogManager } from "../../features/run-state-watchdog"

export function createRunStateWatchdogHook(manager: RunStateWatchdogManager) {
    return {
        event: async (input: any) => {
            const { event } = input
            const sessionID = (event.properties as any)?.sessionID
            if (!sessionID) return

            if (event.type === "session.status") {
                const statusType = (event.properties as any)?.status?.type
                if (statusType === "running") manager.updateState(sessionID, "running")
                else if (statusType === "waiting") manager.updateState(sessionID, "waiting")
                else if (statusType === "idle") manager.updateState(sessionID, "idle")
                
                manager.recordActivity(sessionID, "general")
            }

            if (event.type === "message.updated") {
                const info = (event.properties as any)?.info
                if (info?.role === "assistant" && info?.text) {
                    manager.recordActivity(sessionID, "text")
                }
            }
            
            if (event.type === "session.todo") {
                // If the app surfaces todos in events, you can update it here.
                // Otherwise we might have to rely on polling
            }
        },

        "tool.execute.before": async (input: any) => {
            if (input.sessionID) {
                manager.recordActivity(input.sessionID, "tool")
            }
        }
    }
}
