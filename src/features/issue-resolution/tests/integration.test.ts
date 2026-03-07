import { expect, test, describe, beforeEach, spyOn } from "bun:test"
import { getToolFromRegistry } from "../../../runtime/tools/registry"
import { setSessionIssueMode, clearSessionIssueMode } from "../../claude-code-session-state"
import { getIssueState, updateIssueState, _resetIssueStateForTesting } from "../state"

describe("Strict Issue Resolution Completion Gates", () => {
    const sessionID = "test-session-id"

    beforeEach(() => {
        _resetIssueStateForTesting()
        clearSessionIssueMode(sessionID)
    })

    test("complete_task is blocked if issue mode active and state incomplete", async () => {
        setSessionIssueMode(sessionID)

        const completeTaskTool = getToolFromRegistry("complete_task")

        const mockContext = { sessionID, metadata: () => {} }

        // Try to complete without state
        const response = await completeTaskTool.execute({ message: "Done" }, mockContext)
        expect(response).toMatch(/\[ERROR\] STRICT ISSUE RESOLUTION MODE ACTIVE/)

        // Try to complete with partial state
        updateIssueState(sessionID, { reproduced: true })
        const response2 = await completeTaskTool.execute({ message: "Done" }, mockContext)
        expect(response2).toMatch(/\[ERROR\] STRICT ISSUE RESOLUTION MODE ACTIVE/)
    })

    test("complete_task succeeds if issue mode active and state complete", async () => {
        setSessionIssueMode(sessionID)
        const completeTaskTool = getToolFromRegistry("complete_task")
        const mockContext = { sessionID, metadata: () => {} }

        updateIssueState(sessionID, {
            reproduced: true,
            fixApplied: true,
            reproAfterPassed: true
        })

        const response = await completeTaskTool.execute({ message: "Done" }, mockContext)
        expect(response).not.toMatch(/\[ERROR\] STRICT ISSUE RESOLUTION MODE ACTIVE/)
        expect(response).toMatch(/\[RUNTIME AUTHORIZATION\]/)
    })

    test("complete_task succeeds if issue mode inactive", async () => {
        const completeTaskTool = getToolFromRegistry("complete_task")
        const mockContext = { sessionID, metadata: () => {} }

        const response = await completeTaskTool.execute({ message: "Done" }, mockContext)
        expect(response).not.toMatch(/\[ERROR\] STRICT ISSUE RESOLUTION MODE ACTIVE/)
        expect(response).toMatch(/\[RUNTIME AUTHORIZATION\]/)
    })

    test("report_issue_verification tool updates state", async () => {
        setSessionIssueMode(sessionID)
        const reportTool = getToolFromRegistry("report_issue_verification")
        const mockContext = { sessionID, metadata: () => {} }

        const response = await reportTool.execute({
            reproduced: true,
            errorSignatureBefore: "TypeError: null"
        }, mockContext)

        expect(response).toMatch(/\[VERIFICATION LOGGED\]/)
        
        const state = getIssueState(sessionID)
        expect(state.reproduced).toBe(true)
        expect(state.errorSignatureBefore).toBe("TypeError: null")
        expect(state.fixApplied).toBe(false)
    })
})
