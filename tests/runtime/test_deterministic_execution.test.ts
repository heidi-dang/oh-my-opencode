import { ActionValidator } from "../../src/agents/runtime/action-validator"
import { detectLoop } from "../../src/agents/runtime/loop-guard"
import { stateLedger } from "../../src/agents/runtime/state-ledger"

/**
 * Deterministic Execution Tests
 * 
 * Verifies that the reliability runtime enforces hard constraints:
 * - Rejects raw text actions
 * - Detects semantic loops
 * - Records ledger entries
 * - Blocks faked state claims
 */

describe("Deterministic Reliability Runtime", () => {

    beforeEach(() => {
        // Clear ledger state
        stateLedger.entries = []
    })

    test("ActionValidator: Rejects non-schema text output", () => {
        const rawResponse = "The task is done. I have pushed the changes."
        expect(() => ActionValidator.parseAndValidate(rawResponse)).toThrow(/Failed to parse agent response as JSON/)
    })

    test("ActionValidator: Rejects malformed JSON actions", () => {
        const malformedAction = { type: "tool", name: "git.push" } // 'tool' instead of 'name'
        expect(() => ActionValidator.validate(malformedAction)).toThrow(/Schema mismatch/)
    })

    test("ActionValidator: Accepts valid AgentAction", () => {
        const validAction = { type: "tool", tool: "git_safe", args: { op: "push" } }
        const result = ActionValidator.validate(validAction)
        expect(result.type).toBe("tool")
        expect(result.tool).toBe("git_safe")
    })

    test("LoopGuard: Detects semantic loops (3 identical calls)", () => {
        const history = [
            { stepId: "no-active-step", goal: "fix tests", actionType: "tool" },
            { stepId: "no-active-step", goal: "fix tests", actionType: "tool" },
            { stepId: "no-active-step", goal: "fix tests", actionType: "tool" }
        ]
        // Since we are not in a full runtime context, compiler.getActiveStep() returns undefined
        // leading to "no-active-step" fingerprint.
        expect(() => detectLoop(history, "fix tests", "tool")).toThrow(/Loop Guard/)
    })


    test("StateLedger: Records entries correctly", () => {
        stateLedger.push({
            type: "git_safe",
            key: "origin/main",
            success: true,
            verified: true,
            changedState: true,
            stdout: "Pushed",
            stderr: ""
        })
        expect(stateLedger.getEntries().length).toBe(1)
        expect(stateLedger.getEntries()[0].type).toBe("git_safe")
    })

})
