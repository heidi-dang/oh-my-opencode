import { describe, test, expect, spyOn } from "bun:test"
import { createToolExecuteAfterHandler } from "./tool-execute-after"

describe("Tool Metadata Normalization", () => {
    const createMockHooks = () => {
        const mockToolContract = {
            "tool.execute.after": async (_input: any, _output: any) => {}
        }
        return {
            hooks: {
                toolContract: mockToolContract,
                executionJournal: {},
                claudeCodeHooks: {},
                toolOutputTruncator: {},
                preemptiveCompaction: {},
                contextWindowMonitor: {},
                commentChecker: {},
                directoryAgentsInjector: {},
                directoryReadmeInjector: {},
                rulesInjector: {},
                emptyTaskResponseDetector: {},
                agentUsageReminder: {},
                categorySkillReminder: {},
                interactiveBashSession: {},
                editErrorRecovery: {},
                delegateTaskRetry: {},
                atlasHook: {},
                taskResumeInfo: {},
                readImageResizer: {},
                hashlineReadEnhancer: {},
                jsonErrorRecovery: {}
            },
            mockToolContract
        }
    }

    test("should normalize success and verified for safety-critical tools", async () => {
        const { hooks, mockToolContract } = createMockHooks()
        const spy = spyOn(mockToolContract, "tool.execute.after")
        const handler = createToolExecuteAfterHandler({ hooks } as any)

        const input = { tool: "fs_safe", sessionID: "s1", callID: "c1" }
        const output = { title: "fs read", output: "success", metadata: {} }

        await handler(input, output)

        // The hook should have been called with normalized metadata
        expect(spy).toHaveBeenCalled()
        const normalizedOutput = spy.mock.calls[0][1]
        expect(normalizedOutput.metadata.success).toBe(true)
        expect(normalizedOutput.metadata.verified).toBe(true)
    })

    test("should not overwrite existing results", async () => {
        const { hooks, mockToolContract } = createMockHooks()
        const spy = spyOn(mockToolContract, "tool.execute.after")
        const handler = createToolExecuteAfterHandler({ hooks } as any)

        const input = { tool: "git_safe", sessionID: "s1", callID: "c1" }
        const output = { 
            title: "git status", 
            output: "...", 
            metadata: { success: false, verified: true } 
        }

        await handler(input, output)

        expect(spy).toHaveBeenCalled()
        const normalizedOutput = spy.mock.calls[0][1]
        expect(normalizedOutput.metadata.success).toBe(false)
        expect(normalizedOutput.metadata.verified).toBe(true)
    })
})
