import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { RunStateWatchdogManager } from "./manager"

describe("RunStateWatchdogManager", () => {
    let mockClient: any
    let manager: RunStateWatchdogManager

    beforeEach(() => {
        mockClient = {
            tui: {
                showToast: mock(async () => {})
            }
        }
        // Very short stall threshold for testing
        manager = new RunStateWatchdogManager(mockClient, { pollingIntervalMs: 5, stallThresholdMs: 20 })
    })

    afterEach(() => {
        manager.stop()
    })

    test("Updates state locally but does not toast if not stalled", async () => {
        const sessionID = "sess1"
        manager.updateState(sessionID, "running")
        
        manager.recordActivity(sessionID, "text")
        
        await new Promise(r => setTimeout(r, 10))
        manager.recordActivity(sessionID, "tool")
        
        manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).not.toHaveBeenCalled()
    })

    test("Emits toast if stalled too long without text or tool", async () => {
        const sessionID = "sess1"
        manager.updateState(sessionID, "running")
        manager.recordActivity(sessionID, "text")
        
        await new Promise(r => setTimeout(r, 25))
        
        await manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).toHaveBeenCalled()
        const call = mockClient.tui.showToast.mock.calls[0][0]
        expect(call.body.title).toBe("Task Status")
        expect(call.body.message).toContain("Still working")
    })

    test("Updates state to waiting and toasts appropriately", async () => {
        const sessionID = "sess1"
        manager.updateState(sessionID, "waiting")
        manager.recordActivity(sessionID, "text")
        
        await new Promise(r => setTimeout(r, 25))
        
        await manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).toHaveBeenCalled()
        const call = mockClient.tui.showToast.mock.calls[0][0]
        expect(call.body.title).toBe("Task Status")
        expect(call.body.message).toContain("Waiting for response")
    })

    test("Does not toast if state is idle", async () => {
        const sessionID = "sess1"
        manager.updateState(sessionID, "idle")
        manager.recordActivity(sessionID, "text")
        
        await new Promise(r => setTimeout(r, 25))
        
        await manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).not.toHaveBeenCalled()
    })
})
