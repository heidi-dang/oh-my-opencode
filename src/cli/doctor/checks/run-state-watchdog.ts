import picocolors from "picocolors"
import { CheckDefinition, CheckResult, DoctorIssue } from "../types"
import { RunStateWatchdogManager } from "../../../features/run-state-watchdog/manager"

export const checkRunStateWatchdog: CheckDefinition = {
    id: "run-state-watchdog",
    name: "Run State Watchdog",
    critical: true,
    check: async (): Promise<CheckResult> => {
        const issues: DoctorIssue[] = []
        let hasError = false

        let toastCalls = 0
        const mockClient = {  
            tui: {  
              showToast: async () => { toastCalls++; return { data: {} } }  
            },  
            session: {  
              state: () => ({}),  
              abort: async () => ({ data: {} })  
            }  
          }
        
        // Use a 5ms interval, 20ms stall threshold for fast execution
        const manager = new RunStateWatchdogManager(mockClient as any, { pollingIntervalMs: 5, stallThresholdMs: 20 })

        // 1. Check: Active run with open todos but no text/events -> stalls correctly
        manager.updateState("sess-doctor", "running")
        manager.recordActivity("sess-doctor", "text")
        
        // Wait for warn threshold (0.5-0.6 ratio) ~12ms for 20ms threshold  
        await new Promise(r => setTimeout(r, 12))  
        await (manager as any).checkStalledRuns()
        
        if (toastCalls === 0) {
            hasError = true
            issues.push({
                severity: "error",
                title: "Watchdog Stall Detection Failed",
                description: "Watchdog did not emit a toast when a session with status 'running' had no recent text/tool activity.",
                fix: "Verify RunStateWatchdogManager polling thresholds and state storage."
            })
        }
        
        // Reset
        toastCalls = 0
        manager.updateState("sess-doctor", "idle")
        await new Promise(r => setTimeout(r, 25))
        await (manager as any).checkStalledRuns()
        
        if (toastCalls > 0) {
            hasError = true
            issues.push({
                severity: "warning",
                title: "Watchdog False Positive",
                description: "Watchdog emitted a stall toast for an 'idle' session.",
                fix: "Watchdog should ignore idle or non-active sessions."
            })
        }
        
        manager.stop()

        if (hasError) {
            return {
                name: "Run State Watchdog",
                status: "fail",
                message: picocolors.red("Run State Watchdog failed coverage checks."),
                issues
            }
        }

        return {
            name: "Run State Watchdog",
            status: "pass",
            message: picocolors.green("Watchdog detects and surfaces stalled runs correctly."),
            issues
        }
    }
}
