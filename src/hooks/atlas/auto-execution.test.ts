import { describe, it, expect, mock, beforeEach } from "bun:test"

// Mock dependencies BEFORE importing the handler
mock.module("../../features/boulder-state", () => ({
    readBoulderState: () => ({
        session_ids: ["token-bypass-session"],
        active_plan: "test_plan",
        plan_name: "Test Plan",
        agent: "atlas"
    }),
    getPlanProgress: () => ({ completed: 0, total: 1, isComplete: false })
}))

mock.module("./session-last-agent", () => ({
    getLastAgentFromSession: () => Promise.resolve("atlas")
}))

mock.module("./session-agent-store", () => ({
    getSessionAgent: () => "atlas"
}))

// Import after mocking
import { createAtlasEventHandler } from "./event-handler"
import { compiler } from "../../runtime/plan-compiler"
import { DETERMINISTIC_TOOLS } from "../../runtime/tools/registry"

describe("Atlas Auto-Execution (Token Bypass)", () => {
    const sessionID = "token-bypass-session"
    const sessions = new Map()
    const getState = (id: string) => {
        if (!sessions.has(id)) sessions.set(id, { promptFailureCount: 0 })
        return sessions.get(id)
    }

    const ctx = {
        directory: "/test",
        client: {
            session: {
                get: mock(() => Promise.resolve({ data: { directory: "/test" } })),
                promptAsync: mock(() => Promise.resolve({ data: {} }))
            }
        }
    } as any

    beforeEach(() => {
        compiler.clear(sessionID)
        sessions.clear()
        ctx.client.session.promptAsync.mockClear()
    })

    it("should auto-execute deterministic steps and bypass the LLM turn", async () => {
        // 1. Setup a plan with a deterministic step
        compiler.submit(sessionID, [
            { id: "step1", action: "git_safe", dependencies: [], deterministic: true }
        ])

        // Mock the tool implementation
        const mockToolExecute = mock((args: any, context: any) => {
            context.metadata({ success: true, title: "Git Push" })
            return Promise.resolve("Success Output")
        })
        DETERMINISTIC_TOOLS["git_safe"] = () => ({ execute: mockToolExecute })

        const handler = createAtlasEventHandler({
            ctx,
            sessions,
            getState
        })

        // 2. Dispatch session.idle
        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID }
            }
        })

        // 3. Verify
        expect(mockToolExecute).toHaveBeenCalled()
        expect(compiler.getActiveStep(sessionID)).toBeNull()
        expect(ctx.client.session.promptAsync).not.toHaveBeenCalled()
        
        const state = getState(sessionID)
        expect(state.autoExecutionSummaries).toHaveLength(1)
        expect(state.autoExecutionSummaries[0]).toContain("Success Output")
    })

    it("should fall back to LLM if auto-execution fails", async () => {
        compiler.submit(sessionID, [
            { id: "step1", action: "fs_safe", dependencies: [], deterministic: true }
        ])

        // Mock failure
        const mockToolExecute = mock(() => {
            throw new Error("Disk Full")
        })
        DETERMINISTIC_TOOLS["fs_safe"] = () => ({ execute: mockToolExecute })

        const handler = createAtlasEventHandler({
            ctx,
            sessions,
            getState
        })

        await handler({
            event: {
                type: "session.idle",
                properties: { sessionID }
            }
        })

        // Verify fallback: tool called, step still active, LLM prompted
        expect(mockToolExecute).toHaveBeenCalled()
        expect(compiler.getActiveStep(sessionID)).not.toBeNull()
        expect(ctx.client.session.promptAsync).toHaveBeenCalled()
    })
})
