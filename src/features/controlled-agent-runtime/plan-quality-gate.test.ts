import { describe, test, expect } from "bun:test"

import { validatePlan, createPlanStep } from "./plan-quality-gate"
import type { TaskPlan } from "./types"

describe("PlanQualityGate", () => {
  describe("#given a well-formed plan", () => {
    test("#when all rules met #then plan is valid", () => {
      const plan: TaskPlan = {
        hypothesis: "Login form sends wrong payload format",
        steps: [
          createPlanStep("s1", "Fix payload serialization in auth-handler.ts", "file", "src/features/auth/auth-handler.ts"),
          createPlanStep("s2", "Run targeted tests for auth module", "verification", "bun test src/features/auth/"),
          createPlanStep("s3", "Run full typecheck", "verification", "bun run typecheck"),
        ],
        rollback_path: "git stash pop",
        verification_commands: ["bun test src/features/auth/", "bun run typecheck"],
      }

      const result = validatePlan(plan)
      expect(result.valid).toBe(true)
      expect(result.rejection_reasons).toHaveLength(0)
    })
  })

  describe("#given a vague plan", () => {
    test("#when description is vague #then rejected", () => {
      const plan: TaskPlan = {
        steps: [
          createPlanStep("s1", "I will investigate and fix the issue", "file", "src/some.ts"),
          createPlanStep("s2", "Run tests", "verification", "bun test"),
        ],
        verification_commands: ["bun test"],
      }

      const result = validatePlan(plan)
      expect(result.valid).toBe(false)
      expect(result.rejection_reasons.some(r => r.includes("vague"))).toBe(true)
    })
  })

  describe("#given a plan with too few steps", () => {
    test("#when only 1 step #then rejected", () => {
      const plan: TaskPlan = {
        steps: [createPlanStep("s1", "Fix the bug", "file", "src/bug.ts")],
        verification_commands: [],
      }

      const result = validatePlan(plan)
      expect(result.valid).toBe(false)
      expect(result.rejection_reasons.some(r => r.includes("minimum"))).toBe(true)
    })
  })

  describe("#given a plan without verification", () => {
    test("#when no verification steps or commands #then rejected", () => {
      const plan: TaskPlan = {
        steps: [
          createPlanStep("s1", "Fix serialization bug", "file", "src/a.ts"),
          createPlanStep("s2", "Update import paths", "file", "src/b.ts"),
        ],
        verification_commands: [],
      }

      const result = validatePlan(plan)
      expect(result.valid).toBe(false)
      expect(result.rejection_reasons.some(r => r.includes("verification"))).toBe(true)
    })
  })

  describe("#given a plan with missing target", () => {
    test("#when step has no target_type #then rejected", () => {
      const plan: TaskPlan = {
        steps: [
          { id: "s1", description: "Do something", target_type: "" as any, target_value: "" },
          createPlanStep("s2", "Run tests", "verification", "bun test"),
        ],
        verification_commands: ["bun test"],
      }

      const result = validatePlan(plan)
      expect(result.valid).toBe(false)
      expect(result.rejection_reasons.some(r => r.includes("target_type"))).toBe(true)
    })
  })

  describe("#given a destructive plan without rollback", () => {
    test("#when has delete step but no rollback #then warns", () => {
      const plan: TaskPlan = {
        steps: [
          createPlanStep("s1", "Delete legacy auth module", "file", "src/old-auth.ts"),
          createPlanStep("s2", "Run tests", "verification", "bun test"),
        ],
        verification_commands: ["bun test"],
      }

      const result = validatePlan(plan)
      expect(result.warnings.some(w => w.includes("rollback"))).toBe(true)
    })
  })
})
