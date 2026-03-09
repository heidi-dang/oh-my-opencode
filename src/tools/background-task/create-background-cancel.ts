import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { BackgroundManager } from "../../features/background-agent"
import type { BackgroundCancelArgs } from "./types"
import type { BackgroundCancelClient } from "./clients"
import { BACKGROUND_CANCEL_DESCRIPTION } from "./constants"

export function createBackgroundCancel(manager: BackgroundManager, _client: BackgroundCancelClient): ToolDefinition {
  return tool({
    description: BACKGROUND_CANCEL_DESCRIPTION,
    args: {
      taskId: tool.schema.string().optional().describe("Task ID to cancel (required if all=false)"),
      all: tool.schema.boolean().optional().describe("Cancel all running background tasks (default: false)"),
    },
    async execute(args: BackgroundCancelArgs, toolContext) {
      try {
        const cancelAll = args.all === true

        if (!cancelAll && !args.taskId) {
          return `[ERROR] Invalid arguments: Either provide a taskId or set all=true to cancel all running tasks.`
        }

        if (cancelAll) {
          return `[Safety Audit] Individual completion required. batch-cancellation of all background tasks is forbidden to prevent accidental disruption of critical subagents. Please cancel tasks by ID.`
        }

        if (!args.taskId) {
          return `[ERROR] Invalid arguments: Please provide a taskId.`
        }

        const task = manager.getTask(args.taskId!)
        if (!task) {
          return `[ERROR] Task not found: ${args.taskId}`
        }

        if (task.status !== "running" && task.status !== "pending") {
          return `[ERROR] Cannot cancel task: current status is "${task.status}".
Only running or pending tasks can be cancelled.`
        }

        const cancelled = await manager.cancelTask(task.id, {
          source: "background_cancel",
          abortSession: task.status === "running",
          skipNotification: true,
        })
        if (!cancelled) {
          return `[ERROR] Failed to cancel task: ${task.id}`
        }

        if (task.status === "pending") {
          return `Pending task cancelled successfully

Task ID: ${task.id}
Description: ${task.description}
Status: ${task.status}`
        }

        return `Task cancelled successfully

Task ID: ${task.id}
Description: ${task.description}
Session ID: ${task.sessionID}
Status: ${task.status}`
      } catch (error) {
        return `[ERROR] Error cancelling task: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
