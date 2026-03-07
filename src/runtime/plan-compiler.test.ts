import { describe, it, expect, beforeEach } from "bun:test"
import { compiler } from "./plan-compiler"

describe("PlanCompiler Session Isolation", () => {
    beforeEach(() => {
        compiler.resetAll()
    })

    it("should isolate plans by sessionID", () => {
        const planA = [{ id: "step1", action: "test-auth", dependencies: [] }]
        const planB = [{ id: "step1", action: "test-ui", dependencies: [] }]
        
        compiler.submit("session-A", planA)
        compiler.submit("session-B", planB)
        
        expect(compiler.getActiveStep("session-A")?.action).toBe("test-auth")
        expect(compiler.getActiveStep("session-B")?.action).toBe("test-ui")
    })

    it("should clear state on completion", () => {
        compiler.submit("session-1", [{ id: "s1", action: "act", dependencies: [] }])
        expect(compiler.getActiveStep("session-1")).not.toBeNull()
        
        compiler.markStepComplete("session-1", "s1")
        expect(compiler.getActiveStep("session-1")).toBeNull()
    })

    it("should support manual unlock (clear)", () => {
        compiler.submit("session-1", [{ id: "s1", action: "act", dependencies: [] }])
        expect(compiler.getActiveStep("session-1")).not.toBeNull()
        
        compiler.clear("session-1")
        expect(compiler.getActiveStep("session-1")).toBeNull()
    })

    it("should rotate task IDs on submission", () => {
        const id1 = compiler.submit("session-1", [{ id: "s1", action: "a1", dependencies: [] }])
        const id2 = compiler.submit("session-1", [{ id: "s1", action: "a1", dependencies: [] }])
        expect(id1).not.toBe(id2)
    })
})
