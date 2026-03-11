import { describe, it, expect } from "bun:test"
import { classifyDiagnostic, classifyDiagnostics, isKnownDiagnosticPattern } from "./classifier"
import { getPlaybook, hasPlaybook, getRegisteredClasses } from "./playbook-registry"
import { buildRepairInstructions, formatRepairInstructionsForAgent } from "./repair-instructions-builder"

describe("Diagnostic Intelligence", () => {
  describe("#given classifier", () => {
    describe("#when classifying Python optional-null-attribute errors", () => {
      it("#then should classify 'is not a known attribute of None'", () => {
        const result = classifyDiagnostic({
          message: '"pad_token" is not a known attribute of "None"',
          file: "src/model_host/manager.py",
          line: 200,
          severity: 1,
        })

        expect(result.class).toBe("python.optional-null-attribute")
        expect(result.language).toBe("python")
        expect(result.attribute).toBe("pad_token")
      })

      it("#then should classify float16 attribute error", () => {
        const result = classifyDiagnostic({
          message: '"float16" is not a known attribute of "None"',
          file: "src/model_host/manager.py",
          line: 193,
        })

        expect(result.class).toBe("python.optional-null-attribute")
        expect(result.attribute).toBe("float16")
      })

      it("#then should classify eos_token_id attribute error", () => {
        const result = classifyDiagnostic({
          message: '"eos_token_id" is not a known attribute of "None"',
          file: "src/model_host/manager.py",
          line: 201,
        })

        expect(result.class).toBe("python.optional-null-attribute")
        expect(result.attribute).toBe("eos_token_id")
      })
    })

    describe("#when classifying Python optional-null-subscript errors", () => {
      it("#then should classify 'Object of type None is not subscriptable'", () => {
        const result = classifyDiagnostic({
          message: 'Object of type "None" is not subscriptable',
          file: "src/utils/parser.py",
          line: 42,
        })

        expect(result.class).toBe("python.optional-null-subscript")
        expect(result.language).toBe("python")
      })
    })

    describe("#when classifying Python possibly-unbound errors", () => {
      it("#then should classify 'is possibly unbound'", () => {
        const result = classifyDiagnostic({
          message: '"result" is possibly unbound',
          file: "src/handler.py",
          line: 55,
        })

        expect(result.class).toBe("python.possibly-unbound")
        expect(result.symbol).toBe("result")
      })
    })

    describe("#when classifying TypeScript possibly-undefined errors", () => {
      it("#then should classify 'Object is possibly undefined'", () => {
        const result = classifyDiagnostic({
          message: "Object is possibly 'undefined'",
          file: "src/utils.ts",
          line: 10,
        })

        expect(result.class).toBe("typescript.possibly-undefined")
        expect(result.language).toBe("typescript")
      })

      it("#then should classify with specific variable name", () => {
        const result = classifyDiagnostic({
          message: "'config' is possibly 'undefined'",
          file: "src/config.ts",
          line: 30,
        })

        expect(result.class).toBe("typescript.possibly-undefined")
        expect(result.symbol).toBe("config")
      })
    })

    describe("#when classifying TypeScript nullable-property-access errors", () => {
      it("#then should classify property access on union with undefined", () => {
        const result = classifyDiagnostic({
          message: "Property 'name' does not exist on type 'User | undefined'",
          file: "src/user.ts",
          line: 15,
        })

        expect(result.class).toBe("typescript.nullable-property-access")
        expect(result.symbol).toBe("User")
        expect(result.attribute).toBe("name")
      })
    })

    describe("#when classifying TypeScript type-mismatch errors", () => {
      it("#then should classify type assignment mismatch", () => {
        const result = classifyDiagnostic({
          message: "Type 'string' is not assignable to type 'number'",
          file: "src/calc.ts",
          line: 22,
        })

        expect(result.class).toBe("typescript.type-mismatch")
        expect(result.symbol).toBe("string")
        expect(result.attribute).toBe("number")
      })
    })

    describe("#when classifying TypeScript import errors", () => {
      it("#then should classify missing module", () => {
        const result = classifyDiagnostic({
          message: "Cannot find module 'lodash'",
          file: "src/index.ts",
          line: 1,
        })

        expect(result.class).toBe("typescript.import-error")
        expect(result.symbol).toBe("lodash")
      })
    })

    describe("#when classifying unknown errors", () => {
      it("#then should return unknown class", () => {
        const result = classifyDiagnostic({
          message: "Some random error message",
          file: "src/foo.ts",
          line: 1,
        })

        expect(result.class).toBe("unknown")
      })
    })

    describe("#when using batch classification", () => {
      it("#then should filter out unknown diagnostics by default", () => {
        const results = classifyDiagnostics([
          { message: '"pad_token" is not a known attribute of "None"', file: "a.py", line: 1 },
          { message: "Some random error", file: "b.py", line: 2 },
          { message: "Object is possibly 'undefined'", file: "c.ts", line: 3 },
        ])

        expect(results).toHaveLength(2)
        expect(results[0]!.class).toBe("python.optional-null-attribute")
        expect(results[1]!.class).toBe("typescript.possibly-undefined")
      })

      it("#then should include unknown when requested", () => {
        const results = classifyDiagnostics(
          [{ message: "Random error", file: "a.py", line: 1 }],
          true
        )

        expect(results).toHaveLength(1)
        expect(results[0]!.class).toBe("unknown")
      })
    })

    describe("#when checking known patterns", () => {
      it("#then should return true for known patterns", () => {
        expect(isKnownDiagnosticPattern('"x" is not a known attribute of "None"')).toBe(true)
        expect(isKnownDiagnosticPattern("Object is possibly 'undefined'")).toBe(true)
      })

      it("#then should return false for unknown patterns", () => {
        expect(isKnownDiagnosticPattern("Some random error")).toBe(false)
      })
    })
  })

  describe("#given playbook registry", () => {
    describe("#when looking up playbooks", () => {
      it("#then should have playbooks for all major diagnostic classes", () => {
        const classes = getRegisteredClasses()
        expect(classes.length).toBeGreaterThanOrEqual(7)
        expect(hasPlaybook("python.optional-null-attribute")).toBe(true)
        expect(hasPlaybook("typescript.possibly-undefined")).toBe(true)
      })

      it("#then should return undefined for unknown class", () => {
        expect(getPlaybook("unknown")).toBeUndefined()
      })

      it("#then should have decision trees with at least 2 nodes", () => {
        const playbook = getPlaybook("python.optional-null-attribute")
        expect(playbook).toBeDefined()
        expect(playbook!.decision_tree.length).toBeGreaterThanOrEqual(2)
      })

      it("#then should have anti-patterns for every playbook", () => {
        for (const cls of getRegisteredClasses()) {
          const playbook = getPlaybook(cls)
          expect(playbook!.anti_patterns.length).toBeGreaterThan(0)
        }
      })
    })
  })

  describe("#given repair instructions builder", () => {
    describe("#when building instructions from a classified diagnostic", () => {
      it("#then should produce structured instructions", () => {
        const diagnostic = classifyDiagnostic({
          message: '"pad_token" is not a known attribute of "None"',
          file: "src/model_host/manager.py",
          line: 200,
        })

        const instructions = buildRepairInstructions(diagnostic)
        expect(instructions).not.toBeNull()
        expect(instructions!.diagnostic_class).toBe("python.optional-null-attribute")
        expect(instructions!.file).toBe("src/model_host/manager.py")
        expect(instructions!.inspection_steps.length).toBeGreaterThan(0)
        expect(instructions!.strategy_priority.length).toBeGreaterThan(0)
        expect(instructions!.anti_patterns.length).toBeGreaterThan(0)
      })

      it("#then should produce readable agent-facing text", () => {
        const diagnostic = classifyDiagnostic({
          message: '"pad_token" is not a known attribute of "None"',
          file: "src/model_host/manager.py",
          line: 200,
        })

        const instructions = buildRepairInstructions(diagnostic)
        const formatted = formatRepairInstructionsForAgent(instructions!)

        expect(formatted).toContain("[CAR DIAGNOSTIC REPAIR:")
        expect(formatted).toContain("BEFORE EDITING, INSPECT:")
        expect(formatted).toContain("REPAIR DECISION TREE")
        expect(formatted).toContain("DO NOT:")
        expect(formatted).toContain("VERIFY WITH:")
      })

      it("#then should return null for unknown diagnostic class", () => {
        const diagnostic = classifyDiagnostic({
          message: "Random unknown error",
          file: "src/foo.py",
          line: 1,
        })

        const instructions = buildRepairInstructions(diagnostic)
        expect(instructions).toBeNull()
      })
    })
  })
})
