/**
 * CAR Runtime Hook — Full-stack integration for Controlled Agent Runtime.
 *
 * This hook integrates into 3 OpenCode hook points:
 *   - tool.execute.before: Record file changes via runtime gates
 *   - tool.execute.after: Track changed files + trigger verification
 *   - experimental.chat.messages.transform: Inject CAR state context
 *
 * This is the hook interface. Hard enforcement lives in runtime-gates.ts.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import { taskStateMachine } from "../../features/controlled-agent-runtime/task-state-machine"
import { recordFileChange } from "../../features/controlled-agent-runtime/runtime-gates"

const FILE_WRITE_TOOLS = new Set([
  "write_to_file",
  "create_file",
  "edit_file",
  "apply_patch",
  "hashline_edit",
  "multi_edit_file",
  "replace_file_content",
  "insert_code",
])

export function createCARRuntimeHook(_ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ) => {
      const record = taskStateMachine.getTask(input.sessionID)
      if (!record) return

      // Track which files CAR knows about before they change
      if (FILE_WRITE_TOOLS.has(input.tool)) {
        const filePath = output.args?.path || output.args?.file || output.args?.target_file
        if (typeof filePath === "string") {
          log(`[CARRuntimeHook] Pre-edit tracking: ${filePath}`)
        }
      }
    },

    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: Record<string, unknown> },
    ) => {
      const record = taskStateMachine.getTask(input.sessionID)
      if (!record) return

      // Track file changes through the state machine
      if (FILE_WRITE_TOOLS.has(input.tool)) {
        const filePath =
          output.metadata?.path ||
          output.metadata?.file ||
          output.metadata?.target_file

        if (typeof filePath === "string") {
          recordFileChange(input.sessionID, filePath)
          log(`[CARRuntimeHook] Recorded file change: ${filePath}`)
        }
      }
    },

    "experimental.chat.messages.transform": async (
      _input: Record<string, never>,
      output: { messages: any[] },
    ) => {
      if (!output.messages?.length) return

      // Extract sessionID from the messages if available
      const lastMsg = output.messages[output.messages.length - 1]
      const sessionID = lastMsg?.info?.sessionID || lastMsg?.info?.session_id

      if (!sessionID) return

      const record = taskStateMachine.getTask(sessionID)
      if (!record) return

      const stateReport = taskStateMachine.getStateReport(sessionID)
      const score = taskStateMachine.getAcceptanceScore(sessionID)

      const injections: string[] = [stateReport]

      if (record.lifecycle_state === "REPAIRING") {
        const lastRepair = record.repairs[record.repairs.length - 1]
        injections.push(
          `\n[CAR REPAIR MODE] Previous attempt failed.`,
          `Failure type: ${lastRepair?.failure_type ?? "unknown"}`,
          `Failure evidence: ${lastRepair?.failure_evidence ?? "none"}`,
          `Repair attempt: ${record.repair_loop_count}/3`,
          `Action: Re-read the failure evidence, adjust your approach, fix the specific issue.`,
          `Do NOT restart. Continue from where you left off.`,
        )
      }

      if (record.lifecycle_state === "BLOCKED") {
        injections.push(
          `\n[CAR BLOCKED] Task cannot proceed further.`,
          `Reason: ${record.blocked_reason ?? "unknown"}`,
          `Tell the user exactly what is blocked and what remains.`,
          `Do NOT claim success. Do NOT retry without user input.`,
        )
      }

      if (record.lifecycle_state === "VERIFYING" && score.total > 0 && score.passed < score.total) {
        const failing = record.interpreted_intent?.acceptance_criteria
          .filter(c => !record.acceptance_statuses.some(s => s.criterion_id === c.id && s.passed))
          .map(c => c.description) ?? []

        if (failing.length > 0) {
          injections.push(
            `\n[CAR VERIFICATION] ${score.passed}/${score.total} criteria passed.`,
            `Failing: ${failing.join("; ")}`,
            `Address failing criteria before calling complete_task.`,
          )
        }
      }

      if (record.lifecycle_state !== "DONE" && record.lifecycle_state !== "VERIFYING") {
        injections.push(`\n[CAR GATE] Do not call complete_task until verification is done.`)
      }

      const contextMessage = {
        info: { role: "user" },
        parts: [{ type: "text", text: injections.join("\n") }],
      }

      // Inject before the last user message
      const lastUserIdx = output.messages.length - 1
      output.messages.splice(lastUserIdx, 0, contextMessage)

      log(`[CARRuntimeHook] Injected state context: state=${record.lifecycle_state}`)
    },
  }
}
