import { describe, it, expect, beforeEach } from "bun:test"
import { createToolExecuteBeforeHandler } from "./tool-execute-before"
import { createToolExecuteAfterHandler } from "./tool-execute-after"
import { ledger } from "../runtime/state-ledger"
import { compiler } from "../runtime/plan-compiler"
import { createExecutionJournalHook } from "../hooks/execution-journal/hook"
import { createToolContractHook } from "../hooks/tool-contract/hook"
import { createPlanEnforcementHook } from "../hooks/plan-enforcement/hook"
import { createSemanticLoopGuardHook } from "../hooks/semantic-loop-guard/hook"

describe("Truth Model Integration", () => {
    beforeEach(() => {
        // Clear ledger and compiler before each test
        const entries = ledger.getEntries()
        entries.length = 0

        // Reset compiler
        compiler.submit([])
    })

    it("should write to ledger via executionJournal when tool succeeds with stateChange", async () => {
        const ctx = { directory: "/test", client: {} } as any
        const hooks = {
            executionJournal: createExecutionJournalHook(ctx),
            toolContract: createToolContractHook(ctx),
        } as any

        const handler = createToolExecuteAfterHandler({ hooks })

        const input = { tool: "git_safe", sessionID: "ses_123", callID: "call_1" }
        const output = {
            title: "Executing git_safe",
            output: "Committed changes",
            metadata: {
                success: true,
                verified: true,
                changedState: true,
                args: { command: "commit -m 'test'" },
                stateChange: {
                    type: "git.commit",
                    key: "HEAD",
                    details: { message: "test" }
                }
            }
        }

        await handler(input, output)

        const entries = ledger.getEntries()
        expect(entries).toHaveLength(1)
        expect(entries[0].type).toBe("git.commit")
        expect(entries[0].success).toBe(true)
        expect(entries[0].sessionID).toBe("ses_123")
    })

    it("should reject tool execution if ToolContract metadata is missing", async () => {
        const ctx = { directory: "/test", client: {} } as any
        const hooks = {
            executionJournal: createExecutionJournalHook(ctx),
            toolContract: createToolContractHook(ctx),
        } as any

        const handler = createToolExecuteAfterHandler({ hooks })

        const input = { tool: "git_safe", sessionID: "ses_123", callID: "call_2" }
        const output = {
            title: "Executing git_safe",
            output: "Failed",
            metadata: {
                // missing success/verified/changedState
            }
        }

        let error: any
        try {
            await handler(input, output)
        } catch (e) {
            error = e
        }
        expect(error?.message).toContain("[Tool Contract Violation]")
    })

    it("should reject tool execution if ToolContract success is false", async () => {
        const ctx = { directory: "/test", client: {} } as any
        const hooks = {
            toolContract: createToolContractHook(ctx),
        } as any

        const handler = createToolExecuteAfterHandler({ hooks })

        const input = { tool: "fs_safe", sessionID: "ses_123", callID: "call_3" }
        const output = {
            title: "Executing fs_safe",
            output: "Permission denied",
            metadata: {
                success: false,
                verified: true,
            }
        }

        let error: any
        try {
            await handler(input, output)
        } catch (e) {
            error = e
        }
        expect(error?.message).toContain("[Tool Contract Enforcer]")
    })

    it("should reject action if PlanEnforcement detects deviation", async () => {
        const ctx = { directory: "/test", client: {} } as any
        const hooks = {
            planEnforcement: createPlanEnforcementHook(ctx),
        } as any

        const handler = createToolExecuteBeforeHandler({ ctx, hooks })

        // Set a plan
        compiler.submit([
            { id: "1", action: "edit_file", dependencies: [] }
        ])

        const input = { tool: "git_push", sessionID: "ses_123", callID: "call_4" }
        const output = { args: {} }

        let error: any
        try {
            await handler(input, output)
        } catch (e) {
            error = e
        }
        expect(error?.message).toContain("[Plan Compiler Guard]")
    })

    it("should reject action if SemanticLoopGuard detects repeat action", async () => {
        const ctx = { directory: "/test", client: {} } as any
        const hooks = {
            semanticLoopGuard: createSemanticLoopGuardHook(ctx),
        } as any

        const handler = createToolExecuteBeforeHandler({ ctx, hooks })

        const input = { tool: "ls", sessionID: "ses_loop", callID: "call_5" }
        const output = { args: { path: "." } }

        // First 3 calls should pass
        await handler(input, output)
        await handler(input, output)
        await handler(input, output)

        // 4th call should throw
        let error: any
        try {
            await handler(input, output)
        } catch (e) {
            error = e
        }
        expect(error?.message).toContain("[Semantic Loop Guard]")
    })
})
