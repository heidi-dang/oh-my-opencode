import { SYMBOLS } from "../constants"
import { saveActiveTasks, readActiveTasks } from "../../../shared/active-task-storage"
import type { CheckResult } from "../types"

/**
 * Doctor Check: Subagent Progress Integrity
 * 
 * Verifies that the progress storage utility works correctly
 * and can persist/retrieve task progress.
 */
export async function checkProgress(): Promise<CheckResult> {
    const findings: string[] = []
    let passed = true

    try {
        // 1. Test Storage Persistence
        const testTask = {
            id: "doctor-test-task-" + Date.now(),
            sessionID: "test-session",
            description: "Doctor progress check",
            agent: "sisyphus",
            status: "running",
            startedAt: new Date().toISOString(),
            progress: {
                phase: "Testing",
                percent: 50,
                message: "Halfway there"
            }
        }

        const originalTasks = readActiveTasks()
        saveActiveTasks([...originalTasks, testTask])
        
        const updatedTasks = readActiveTasks()
        const found = updatedTasks.find(t => t.id === testTask.id)

        if (!found) {
            passed = false
            findings.push(`${SYMBOLS.cross} Failed to persist active task.`)
        } else if (found.progress?.percent !== 50) {
            passed = false
            findings.push(`${SYMBOLS.cross} Persisted progress data is incorrect.`)
        } else {
            findings.push(`${SYMBOLS.check} Progress storage persistence verified.`)
        }

        // Cleanup
        saveActiveTasks(originalTasks)

    } catch (error: any) {
        passed = false
        findings.push(`${SYMBOLS.cross} Progress check crashed: ${error.message}`)
    }

    return {
        name: "Subagent Progress",
        status: passed ? "pass" : "fail",
        message: passed 
            ? "Subagent progress tracking is healthy." 
            : "Subagent progress tracking has issues.",
        issues: passed ? [] : [{
            title: "Progress tracking failure",
            description: "The system failed to persist or retrieve background task progress.",
            severity: "error"
        }]
    }
}
