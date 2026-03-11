import { describe, it, expect } from "bun:test"
import {
  formatStatus,
  formatStateTransition,
  formatToolResult,
  formatRecoveryEvent,
  formatVerificationResult,
  formatBlockedCondition,
  formatCompletion,
} from "./formatter"
import { STATE_MESSAGES, TOOL_MESSAGES, RECOVERY_MESSAGES, VERIFICATION_MESSAGES, BLOCKED_MESSAGES, COMPLETION_MESSAGES } from "./messages"
import type { ToneMode, StatusCategory } from "./types"

describe("User-Facing Status Formatter", () => {
  describe("#given state transition formatting", () => {
    describe("#when formatting with different tones", () => {
      it("#then should return different wording per tone", () => {
        const neutral = formatStateTransition("EXECUTING", "neutral")
        const friendly = formatStateTransition("EXECUTING", "friendly")
        const playful = formatStateTransition("EXECUTING", "playful")

        expect(neutral.headline).toBe("Executing changes.")
        expect(friendly.headline).toBe("Heidi is working through the changes.")
        expect(playful.headline).toBe("Heidi is in the zone, making edits.")
      })
    })

    describe("#when formatting all TaskState values", () => {
      it("#then should produce non-empty headlines for every state", () => {
        const states = [
          "NEW", "INTERPRETING", "RETRIEVING", "PLANNED", "EXECUTING",
          "WAITING_FOR_EDIT_REVIEW", "WAITING_FOR_BACKGROUND_PROCESS",
          "VERIFYING", "REPAIRING", "STALL_DETECTED", "AUTO_RECOVERING",
          "SUBAGENT_DEBUGGING", "DONE", "BLOCKED",
        ]
        const tones: ToneMode[] = ["neutral", "friendly", "playful"]

        for (const state of states) {
          for (const tone of tones) {
            const result = formatStateTransition(state, tone)
            expect(result.headline).toBeTruthy()
            expect(result.headline.length).toBeGreaterThan(0)
          }
        }
      })
    })
  })

  describe("#given tone auto-escalation", () => {
    describe("#when playful tone is used with error states", () => {
      it("#then should escalate BLOCKED to friendly wording", () => {
        const playful = formatStateTransition("BLOCKED", "playful")
        const friendly = formatStateTransition("BLOCKED", "friendly")

        expect(playful.headline).toBe(friendly.headline)
      })

      it("#then should escalate recovery_failed to friendly wording", () => {
        const playful = formatRecoveryEvent("recovery_failed", "playful")
        const friendly = formatRecoveryEvent("recovery_failed", "friendly")

        expect(playful.headline).toBe(friendly.headline)
      })

      it("#then should escalate build_fail to friendly wording", () => {
        const playful = formatVerificationResult("build_fail", "playful")
        const friendly = formatVerificationResult("build_fail", "friendly")

        expect(playful.headline).toBe(friendly.headline)
      })

      it("#then should not escalate normal states", () => {
        const playful = formatStateTransition("EXECUTING", "playful")
        const friendly = formatStateTransition("EXECUTING", "friendly")

        expect(playful.headline).not.toBe(friendly.headline)
      })
    })
  })

  describe("#given context injection", () => {
    describe("#when context includes file and repair pass", () => {
      it("#then should produce a detail line", () => {
        const result = formatStateTransition("REPAIRING", "friendly", {
          file: "src/shared/memory-db.ts",
          repairPass: 2,
          maxRepairPasses: 3,
        })

        expect(result.headline).toBe("Heidi found an issue and is fixing it.")
        expect(result.detail).toContain("memory-db.ts")
        expect(result.detail).toContain("Repair pass 2 of 3")
      })
    })

    describe("#when context includes tool name and reason", () => {
      it("#then should include both in the detail line", () => {
        const result = formatToolResult("failure", "friendly", {
          toolName: "apply_patch",
          reason: "File not found",
        })

        expect(result.headline).toContain("did not work")
        expect(result.detail).toContain("apply_patch")
        expect(result.detail).toContain("File not found")
      })
    })
  })

  describe("#given unknown keys", () => {
    describe("#when an unknown state key is provided", () => {
      it("#then should fall back to a generic status message", () => {
        const result = formatStateTransition("UNKNOWN_STATE", "friendly")
        expect(result.headline).toBe("Status: UNKNOWN_STATE")
      })
    })
  })

  describe("#given convenience wrappers", () => {
    it("#then formatToolResult should work for all results", () => {
      expect(formatToolResult("success", "friendly").headline).toContain("successfully")
      expect(formatToolResult("failure", "friendly").headline).toContain("did not work")
      expect(formatToolResult("timeout", "friendly").headline).toContain("too long")
    })

    it("#then formatBlockedCondition should work", () => {
      const result = formatBlockedCondition("user_input_required", "playful")
      expect(result.headline).toContain("input")
    })

    it("#then formatCompletion should work", () => {
      const result = formatCompletion("verified_complete", "friendly")
      expect(result.headline).toContain("verified")
    })
  })
})
