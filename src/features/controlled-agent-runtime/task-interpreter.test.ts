import { describe, test, expect, beforeEach } from "bun:test"

import { interpretTask } from "./task-interpreter"

describe("TaskInterpreter", () => {
  describe("#given a bugfix prompt", () => {
    test("#when prompt contains fix keywords #then type is bugfix", () => {
      const intent = interpretTask("Fix the login page crash when submitting empty credentials")
      expect(intent.task_type).toBe("bugfix")
      expect(intent.acceptance_criteria.length).toBeGreaterThan(2)
      expect(intent.acceptance_criteria.some(c => c.id === "repro_before")).toBe(true)
      expect(intent.acceptance_criteria.some(c => c.id === "repro_after")).toBe(true)
      expect(intent.rollback_policy).toBe("lightweight")
    })
  })

  describe("#given a feature prompt", () => {
    test("#when prompt contains create keywords #then type is feature", () => {
      const intent = interpretTask("Create a new dashboard component for displaying user analytics")
      expect(intent.task_type).toBe("feature")
      expect(intent.acceptance_criteria.some(c => c.id === "feature_implemented")).toBe(true)
      expect(intent.acceptance_criteria.some(c => c.id === "tests_added")).toBe(true)
    })
  })

  describe("#given a refactor prompt", () => {
    test("#when prompt contains refactor keywords #then type is refactor with full rollback", () => {
      const intent = interpretTask("Refactor the authentication module to use the new token service")
      expect(intent.task_type).toBe("refactor")
      expect(intent.rollback_policy).toBe("full")
      expect(intent.acceptance_criteria.some(c => c.id === "behavior_preserved")).toBe(true)
    })
  })

  describe("#given a research prompt", () => {
    test("#when prompt is investigative #then type is research with no criteria", () => {
      const intent = interpretTask("Explain how the model fallback chain works in the CLI installer")
      expect(intent.task_type).toBe("research")
      expect(intent.rollback_policy).toBe("noop")
      expect(intent.acceptance_criteria).toHaveLength(0)
    })
  })

  describe("#given a prompt with file paths", () => {
    test("#when prompt mentions src/ paths #then likely_areas are detected", () => {
      const intent = interpretTask("Fix the bug in src/features/auth/login-handler.ts that causes a crash")
      expect(intent.likely_areas).toContain("src/features/auth/login-handler.ts")
    })
  })

  describe("#given a vague prompt", () => {
    test("#when prompt is too short #then needs clarification", () => {
      const intent = interpretTask("fix it")
      expect(intent.needs_clarification).toBe(true)
      expect(intent.clarification_questions).toBeDefined()
    })

    test("#when prompt is detailed #then no clarification needed", () => {
      const intent = interpretTask("Fix the TypeScript compilation error in src/plugin/event.ts caused by missing import for SafeToastWrapper")
      expect(intent.needs_clarification).toBe(false)
    })
  })
})
