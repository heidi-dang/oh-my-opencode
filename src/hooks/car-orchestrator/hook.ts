/**
 * CAR Orchestrator Hook — Injection and soft shaping for the CAR pipeline.
 *
 * This is a messages.transform hook. It does NOT enforce truth —
 * that is done by runtime-gates.ts and completion-firewall.ts.
 *
 * Responsibilities:
 *   - Inject CAR state report as system context on every turn
 *   - Inject acceptance criteria status
 *   - Inject retrieval bundle summary on first turn
 *   - Inject repair instructions if in REPAIRING state
 *   - Soft-block completion language if state machine is not ready
 */

import { log } from "../../shared/logger"
import { taskStateMachine } from "../../features/controlled-agent-runtime/task-state-machine"

export function createCAROrchestatorHook() {
  return {
    name: "car-orchestrator" as const,
    transform(messages: any[], sessionID?: string): any[] {
      if (!sessionID) return messages

      const record = taskStateMachine.getTask(sessionID)
      if (!record) return messages

      const stateReport = taskStateMachine.getStateReport(sessionID)
      const score = taskStateMachine.getAcceptanceScore(sessionID)

      const injections: string[] = [stateReport]

      if (record.lifecycle_state === "REPAIRING") {
        const lastRepair = record.repairs[record.repairs.length - 1]
        injections.push(
          `\n[CAR REPAIR MODE] Previous attempt failed.`,
          `Failure type: ${lastRepair?.failure_type ?? "unknown"}`,
          `Failure evidence: ${lastRepair?.failure_evidence ?? "none"}`,
          `Repair attempt: ${record.repair_loop_count}/${3}`,
          `Action: Re-read the failure evidence, adjust your approach, and fix the specific issue.`,
          `Do NOT restart the entire task. Continue from where you left off.`
        )
      }

      if (record.lifecycle_state === "BLOCKED") {
        injections.push(
          `\n[CAR BLOCKED] Task cannot proceed further.`,
          `Reason: ${record.blocked_reason ?? "unknown"}`,
          `Tell the user exactly what is blocked and what remains.`,
          `Do NOT claim success. Do NOT retry without user input.`
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
            `You must address failing criteria before calling complete_task.`
          )
        }
      }

      if (record.lifecycle_state !== "DONE" && record.lifecycle_state !== "VERIFYING") {
        injections.push(
          `\n[CAR GATE] Do not call complete_task until verification is done.`
        )
      }

      const contextMessage = {
        info: { role: "user" },
        parts: [{ type: "text", text: injections.join("\n") }],
      }

      const lastUserIdx = messages.length - 1
      const result = [...messages]
      result.splice(lastUserIdx, 0, contextMessage)

      log(`[CAROrchestrator] Injected state context for session ${sessionID} in state ${record.lifecycle_state}`)
      return result
    },
  }
}
