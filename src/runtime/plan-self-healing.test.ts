import { describe, it, expect, beforeEach } from "bun:test"
import { compiler } from "./plan-compiler"

describe("PlanCompiler Self-Healing", () => {
    beforeEach(() => {
        compiler.resetAll()
    })

    it("should initialize with planned mode and zero recovery attempts", () => {
        const sessionID = "test_session"
        compiler.submit(sessionID, [{ id: "step1", action: "read", dependencies: [] }])
        
        const active = compiler.getActiveStep(sessionID)
        expect(active?.mode).toBe("planned")
        expect(active?.recoveryAttempts).toBe(0)
    })

    it("should allow transitioning to recovery mode", () => {
        const sessionID = "test_session"
        compiler.submit(sessionID, [{ id: "step1", action: "read", dependencies: [] }])
        
        compiler.setMode(sessionID, "recovery")
        const active = compiler.getActiveStep(sessionID)
        expect(active?.mode).toBe("recovery")
    })

    it("should track and increment recovery attempts", () => {
        const sessionID = "test_session"
        compiler.submit(sessionID, [{ id: "step1", action: "read", dependencies: [] }])
        
        expect(compiler.incrementRecoveryAttempts(sessionID)).toBe(1)
        expect(compiler.incrementRecoveryAttempts(sessionID)).toBe(2)
        
        const active = compiler.getActiveStep(sessionID)
        expect(active?.recoveryAttempts).toBe(2)
    })

    it("should update heartbeat on getActiveStep", async () => {
        const sessionID = "test_session"
        compiler.submit(sessionID, [{ id: "step1", action: "read", dependencies: [] }])
        
        const firstTouch = compiler.getActiveStep(sessionID)?.lastTouch || 0
        await new Promise(resolve => setTimeout(resolve, 10))
        
        const secondTouch = compiler.getActiveStep(sessionID)?.lastTouch || 0
        expect(secondTouch).toBeGreaterThan(firstTouch)
    })
})
