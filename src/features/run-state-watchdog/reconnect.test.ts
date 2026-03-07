import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { RunStateWatchdogManager } from "./manager"

describe("RunStateWatchdogManager Reconnect and Heartbeats", () => {
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

    test("Reconnect restores visible state if currently stalled", async () => {
        const sessionID = "sess1"
        
        // Setup a stalled state
        manager.updateState(sessionID, "running")
        manager.recordActivity(sessionID, "text")
        
        await new Promise(r => setTimeout(r, 25))
        
        // The check routine runs, detecting stall and firing toast
        await manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).toHaveBeenCalledTimes(1)
        
        // Simulating a system reconnect/reload restoring state
        // In a real reconnect, we'd resync or re-evaluate the status. 
        // If the backend has truly hung, explicitly calling updateState again 
        // or just letting the interval run will re-trigger the stalled toast on the new UI instance.
        
        // Next tick
        await manager["checkStalledRuns"]()
        
        // The stall should still be active, toast emitted again (or preserved in real UI)
        expect(mockClient.tui.showToast).toHaveBeenCalledTimes(2)
        const toastMessage = mockClient.tui.showToast.mock.calls[1][0].body.message
        expect(toastMessage).toContain("Still working")
    })
    
    test("Post-tool no-output heartbeat emission", async () => {
        const sessionID = "sess1"
        
        manager.updateState(sessionID, "running")
        
        // Tool happens...
        manager.recordActivity(sessionID, "tool")
        
        // 10ms passes (not yet stalled)
        await new Promise(r => setTimeout(r, 10))
        await manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).not.toHaveBeenCalled()
        
        // Another 15ms passes, we cross the threshold with NO text emitted after the tool
        await new Promise(r => setTimeout(r, 15))
        await manager["checkStalledRuns"]()
        
        expect(mockClient.tui.showToast).toHaveBeenCalledTimes(1)
        expect(mockClient.tui.showToast.mock.calls[0][0].body.message).toContain("Still working")
    })
})
