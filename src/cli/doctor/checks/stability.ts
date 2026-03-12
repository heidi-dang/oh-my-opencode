import picocolors from "picocolors"
import { CheckDefinition, CheckResult, DoctorIssue } from "../types"
import { RunStateWatchdogManager } from "../../../features/run-state-watchdog/manager"
import { contextCollector } from "../../../features/context-injector"
import fs from "fs"
import path from "path"

export const checkStability: CheckDefinition = {
    id: "stability",
    name: "Production-Grade Stability (9.5 Goal)",
    critical: true,
    check: async (): Promise<CheckResult> => {
        const issues: DoctorIssue[] = []
        let hasError = false

        // 1. Verify Watchdog Threshold (90s default)
        const watchdogManager = new RunStateWatchdogManager({   
            session: { state: () => ({}), abort: async () => ({ data: {} }) },  
            tui: { showToast: async () => ({ data: {} }) }  
          } as any)
        const threshold = (watchdogManager as any).stallThresholdMs
        if (threshold !== 90000) {
            hasError = true
            issues.push({
                severity: "error",
                title: "Insecure Watchdog Threshold",
                description: `Watchdog threshold is ${threshold}ms instead of 90000ms. Aggressive thresholds cause random stops.`,
                fix: "Update stallThresholdMs in RunStateWatchdogManager constructor."
            })
        }

        // 2. Verify Dynamic Truncator Ratio (3.0)
        // We check the source code for this one as it's a constant
        const truncatorPath = path.resolve(process.cwd(), "src/shared/dynamic-truncator.ts")
        if (fs.existsSync(truncatorPath)) {
            const content = fs.readFileSync(truncatorPath, "utf-8")
            if (!content.includes("CHARS_PER_TOKEN_ESTIMATE = 3")) {
                hasError = true
                issues.push({
                    severity: "warning",
                    title: "Optimistic Token Estimation",
                    description: "Token estimation ratio is likely > 3.0, risking context overflows.",
                    fix: "Set CHARS_PER_TOKEN_ESTIMATE to 3 in dynamic-truncator.ts"
                })
            }
        }

        // 3. Verify Global Error Handlers in index.ts
        const indexPath = path.resolve(process.cwd(), "src/index.ts")
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, "utf-8")
            const hasHandlers = content.includes("unhandledRejection") && content.includes("uncaughtException")
            if (!hasHandlers) {
                hasError = true
                issues.push({
                    severity: "error",
                    title: "Missing Global Exception Protection",
                    description: "Plugin entry point lacks unhandledRejection/uncaughtException handlers.",
                    fix: "Implement global error protection in src/index.ts"
                })
            }
        }

        // 4. Verify Goal Primacy Registration in Collector
        // Registration is dynamic, but we can check if the method exists
        if (typeof (contextCollector as any).clearNonPersistent !== "function") {
             hasError = true
             issues.push({
                 severity: "error",
                 title: "Missing Context Persistence Logic",
                 description: "ContextCollector does not support clearNonPersistent method. Goal primacy will fail.",
                 fix: "Implement clearNonPersistent and persistent flag in ContextCollector."
             })
        }

        let score = 10
        if (hasError) {
            score -= issues.filter(i => i.severity === "error").length * 2
            score -= issues.filter(i => i.severity === "warning").length * 0.5
        }
        score = Math.max(0, score)

        if (hasError) {
            return {
                name: "Stability Audit",
                status: "fail",
                message: picocolors.red(`Stability score: ${score}/10. Agent is NOT production-ready yet.`),
                issues
            }
        }

        return {
            name: "Stability Audit",
            status: "pass",
            message: picocolors.green(`Reliability Score: ${score}/10. All markers verified.`),
            issues
        }
    }
}
