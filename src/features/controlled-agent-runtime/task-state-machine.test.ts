import { describe, test, expect, beforeEach } from "bun:test"

import { TaskStateMachine } from "./task-state-machine"
import type { TaskIntent } from "./types"

function createTestIntent(overrides: Partial<TaskIntent> = {}): TaskIntent {
  return {
    goal: "Fix the broken login page",
    constraints: [],
    acceptance_criteria: [
      { id: "typecheck", description: "Typecheck passes", verification_method: "build" },
      { id: "tests", description: "Tests pass", verification_method: "test" },
    ],
    likely_areas: ["src/features/auth"],
    task_type: "bugfix",
    needs_clarification: false,
    forbidden_assumptions: [],
    rollback_policy: "lightweight",
    ...overrides,
  }
}

describe("TaskStateMachine", () => {
  let machine: TaskStateMachine

  beforeEach(() => {
    machine = new TaskStateMachine()
  })

  describe("#given a new task", () => {
    test("#when created #then state is NEW", () => {
      const record = machine.createTask("session-1", "Fix login bug")
      expect(record.lifecycle_state).toBe("NEW")
      expect(record.session_id).toBe("session-1")
      expect(record.raw_prompt).toBe("Fix login bug")
    })
  })

  describe("#given valid transitions", () => {
    test("#when transitioning NEW → INTERPRETING #then succeeds", () => {
      machine.createTask("s1", "prompt")
      const result = machine.transition("s1", "INTERPRETING")
      expect(result).toBe(true)
      expect(machine.getTask("s1")?.lifecycle_state).toBe("INTERPRETING")
    })

    test("#when transitioning through full pipeline #then all succeed", () => {
      machine.createTask("s1", "prompt")
      expect(machine.transition("s1", "INTERPRETING")).toBe(true)
      expect(machine.transition("s1", "RETRIEVING")).toBe(true)
      expect(machine.transition("s1", "PLANNED")).toBe(true)
      expect(machine.transition("s1", "EXECUTING")).toBe(true)
      expect(machine.transition("s1", "VERIFYING")).toBe(true)
    })
  })

  describe("#given invalid transitions", () => {
    test("#when skipping stages #then rejected", () => {
      machine.createTask("s1", "prompt")
      const result = machine.transition("s1", "EXECUTING")
      expect(result).toBe(false)
      expect(machine.getTask("s1")?.lifecycle_state).toBe("NEW")
    })

    test("#when transitioning non-existent session #then rejected", () => {
      const result = machine.transition("ghost", "INTERPRETING")
      expect(result).toBe(false)
    })
  })

  describe("#given DONE transition", () => {
    test("#when calling transition(DONE) directly #then blocked", () => {
      machine.createTask("s1", "prompt")
      machine.transition("s1", "INTERPRETING")
      machine.transition("s1", "RETRIEVING")
      machine.transition("s1", "PLANNED")
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")

      const result = machine.transition("s1", "DONE")
      expect(result).toBe(false)
      expect(machine.getTask("s1")?.lifecycle_state).toBe("VERIFYING")
    })

    test("#when promoteToDone from VERIFYING #then succeeds", () => {
      machine.createTask("s1", "prompt")
      machine.transition("s1", "INTERPRETING")
      machine.transition("s1", "RETRIEVING")
      machine.transition("s1", "PLANNED")
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")

      const result = machine.promoteToDone("s1")
      expect(result).toBe(true)
      expect(machine.getTask("s1")?.lifecycle_state).toBe("DONE")
    })

    test("#when promoteToDone from EXECUTING #then rejected", () => {
      machine.createTask("s1", "prompt")
      machine.transition("s1", "INTERPRETING")
      machine.transition("s1", "RETRIEVING")
      machine.transition("s1", "PLANNED")
      machine.transition("s1", "EXECUTING")

      const result = machine.promoteToDone("s1")
      expect(result).toBe(false)
      expect(machine.getTask("s1")?.lifecycle_state).toBe("EXECUTING")
    })
  })

  describe("#given repair loops", () => {
    test("#when repairing within limit #then allowed", () => {
      machine.createTask("s1", "prompt")
      machine.transition("s1", "INTERPRETING")
      machine.transition("s1", "RETRIEVING")
      machine.transition("s1", "PLANNED")
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")

      expect(machine.transition("s1", "REPAIRING")).toBe(true)
      expect(machine.getTask("s1")?.repair_loop_count).toBe(1)

      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")
      expect(machine.transition("s1", "REPAIRING")).toBe(true)
      expect(machine.getTask("s1")?.repair_loop_count).toBe(2)
    })

    test("#when exceeding max repairs #then forced to BLOCKED", () => {
      machine.createTask("s1", "prompt")
      machine.transition("s1", "INTERPRETING")
      machine.transition("s1", "RETRIEVING")
      machine.transition("s1", "PLANNED")
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")

      machine.transition("s1", "REPAIRING") // 1
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")
      machine.transition("s1", "REPAIRING") // 2
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")
      machine.transition("s1", "REPAIRING") // 3
      machine.transition("s1", "EXECUTING")
      machine.transition("s1", "VERIFYING")

      const result = machine.transition("s1", "REPAIRING") // 4 = rejected
      expect(result).toBe(false)
      expect(machine.getTask("s1")?.lifecycle_state).toBe("BLOCKED")
    })
  })

  describe("#given acceptance scoring", () => {
    test("#when no criteria set #then ratio is 1", () => {
      machine.createTask("s1", "prompt")
      const score = machine.getAcceptanceScore("s1")
      expect(score.total).toBe(0)
      expect(score.ratio).toBe(1)
    })

    test("#when criteria set with partial statuses #then score reflects", () => {
      machine.createTask("s1", "prompt")
      machine.setIntent("s1", createTestIntent())
      machine.updateAcceptanceStatuses("s1", [
        { criterion_id: "typecheck", passed: true, checked_at: Date.now() },
        { criterion_id: "tests", passed: false, checked_at: Date.now() },
      ])

      const score = machine.getAcceptanceScore("s1")
      expect(score.total).toBe(2)
      expect(score.passed).toBe(1)
      expect(score.ratio).toBe(0.5)
    })
  })

  describe("#given state report", () => {
    test("#when BLOCKED #then includes reason", () => {
      machine.createTask("s1", "prompt")
      machine.transition("s1", "BLOCKED")
      machine.setBlockedReason("s1", "Build failed after 3 retries", ["typecheck"])

      const report = machine.getStateReport("s1")
      expect(report).toContain("BLOCKED")
      expect(report).toContain("Build failed after 3 retries")
      expect(report).toContain("typecheck")
    })
  })
})
