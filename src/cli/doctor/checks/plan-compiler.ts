import { SYMBOLS } from "../constants"
import { compiler } from "../../../runtime/plan-compiler"
import type { CheckResult } from "../types"

/**
 * Doctor Check: Plan Compiler Integrity
 * 
 * Verifies that the Plan Compiler correctly handles session isolation
 * and doesn't allow stale plans from one session to block another.
 */
export async function checkPlanCompiler(): Promise<CheckResult> {
    const findings: string[] = []
    let passed = true

    try {
        // 1. Test Session Isolation
        const sessionA = "doctor-session-a-" + Date.now()
        const sessionB = "doctor-session-b-" + Date.now()

        compiler.submit(sessionA, [
            { id: "step1", action: "exclusive-action-a", dependencies: [] }
        ])

        const activeA = compiler.getActiveStep(sessionA)
        const activeB = compiler.getActiveStep(sessionB)

        if (activeA?.action !== "exclusive-action-a") {
            passed = false
            findings.push(`${SYMBOLS.cross} Session A plan not correctly stored.`)
        }

        if (activeB !== null) {
            passed = false
            findings.push(`${SYMBOLS.cross} Session B is polluted by Session A's plan. Cross-session leakage detected!`)
        } else {
            findings.push(`${SYMBOLS.check} Session isolation verified.`)
        }

        // 2. Test Manual Recovery (Unlock)
        compiler.clear(sessionA)
        if (compiler.getActiveStep(sessionA) !== null) {
            passed = false
            findings.push(`${SYMBOLS.cross} Manual unlock failed to clear session state.`)
        } else {
            findings.push(`${SYMBOLS.check} Manual unlock (clear) verified.`)
        }

        // 3. Test TaskID generation
        const taskID1 = compiler.submit(sessionA, [{ id: "s1", action: "a1", dependencies: [] }])
        const taskID2 = compiler.submit(sessionA, [{ id: "s2", action: "a2", dependencies: [] }])
        
        if (taskID1 === taskID2) {
            findings.push(`${SYMBOLS.warn} Task IDs are not unique across subsequent submits in the same session.`)
        } else {
            findings.push(`${SYMBOLS.check} Task ID rotation verified.`)
        }

    } catch (error: any) {
        passed = false
        findings.push(`${SYMBOLS.cross} Plan Compiler check crashed: ${error.message}`)
    }

    return {
        name: "Plan Compiler",
        status: passed ? "pass" : "fail",
        message: passed 
            ? "Plan Compiler is healthy and correctly isolating sessions." 
            : "Plan Compiler has integrity issues (isolation or recovery failure).",
        details: findings,
        issues: passed ? [] : [{
            title: "Plan Compiler integrity failure",
            description: "Deterministic plan enforcement or session isolation is broken.",
            severity: "error"
        }]
    }
}
