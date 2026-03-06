import { describe, it, expect, beforeEach } from "bun:test"
import { createToolExecuteBeforeHandler } from "./tool-execute-before"
import { createToolExecuteAfterHandler } from "./tool-execute-after"
import { createMessagesTransformHandler } from "./messages-transform"
import { ledger } from "../runtime/state-ledger"
import { compiler } from "../runtime/plan-compiler"
import { createExecutionJournalHook } from "../hooks/execution-journal/hook"
import { createToolContractHook } from "../hooks/tool-contract/hook"
import { createPlanEnforcementHook } from "../hooks/plan-enforcement/hook"
import { createSemanticLoopGuardHook } from "../hooks/semantic-loop-guard/hook"
import { createRuntimeEnforcementHook } from "../hooks/runtime-enforcement/hook"

describe("Deep Truth Model Integration", () => {
    beforeEach(() => {
        // REAL LEDGER CLEAR
        ledger.clear()

        // Reset compiler
        compiler.submit([])
    })

    describe("ToolContract & ExecutionJournal (After Hooks)", () => {
        it("should pass when tool succeeds and ledger match is perfect", async () => {
            const ctx = { directory: "/test", client: {} } as any
            const hooks = {
                executionJournal: createExecutionJournalHook(ctx),
                toolContract: createToolContractHook(ctx),
            } as any

            const handler = createToolExecuteAfterHandler({ hooks })

            const input = { tool: "fs_safe", sessionID: "ses_correct", callID: "call_1" }
            const output = {
                title: "Writing file",
                output: "Success",
                metadata: {
                    success: true,
                    verified: true,
                    changedState: true,
                    args: { path: "foo.txt" },
                    stateChange: {
                        type: "file.write",
                        key: "foo.txt"
                    }
                }
            }

            // executionJournal writes to ledger, toolContract verifies it
            await handler(input, output)

            const entries = ledger.getEntries()
            expect(entries).toHaveLength(1)
            expect(entries[0].sessionID).toBe("ses_correct")
        })

        it("should REJECT if ledger entry exists but for a DIFFERENT session", async () => {
            // Pre-seed ledger with a "stale" entry from another session
            ledger.record("file.write", "stale.txt", true, true, true, "Old success", {}, "ses_OTHER")

            const ctx = { directory: "/test", client: {} } as any
            const hooks = {
                // We SKIP executionJournal to simulate a tool that didn't write its own entry
                toolContract: createToolContractHook(ctx),
            } as any

            const handler = createToolExecuteAfterHandler({ hooks })

            const input = { tool: "fs_safe", sessionID: "ses_current", callID: "call_2" }
            const output = {
                title: "Writing file",
                output: "Success",
                metadata: {
                    success: true,
                    verified: true,
                    changedState: true,
                    stateChange: { type: "file.write", key: "stale.txt" }
                }
            }

            let error: any
            try {
                await handler(input, output)
            } catch (e) {
                error = e
            }
            expect(error?.message).toContain("no matching SUCCESSFUL and VERIFIED entry was found")
        })

        it("should REJECT if ledger entry exists but is UNVERIFIED", async () => {
            const sessionID = "ses_unverified"
            // Record unverified entry
            ledger.record("git.push", "origin", true, false, true, "Pushed?", {}, sessionID)

            const ctx = { directory: "/test", client: {} } as any
            const hooks = { toolContract: createToolContractHook(ctx) } as any
            const handler = createToolExecuteAfterHandler({ hooks })

            const input = { tool: "git_safe", sessionID, callID: "call_3" }
            const output = {
                title: "Pushing",
                output: "Done",
                metadata: {
                    success: true,
                    verified: true,
                    changedState: true,
                    stateChange: { type: "git.push", key: "origin" }
                }
            }

            let error: any
            try {
                await handler(input, output)
            } catch (e) {
                error = e
            }
            expect(error?.message).toContain("no matching SUCCESSFUL and VERIFIED entry was found")
        })
    })

    describe("RuntimeEnforcement (Message Transform)", () => {
        it("should REJECT completion claim if corresponding tool was NOT called in current flow", async () => {
            const ctx = { directory: "/test" } as any
            const hooks = {
                runtimeEnforcement: createRuntimeEnforcementHook(ctx)
            } as any

            const handler = createMessagesTransformHandler({ hooks })

            const input = {} as any
            const output = {
                messages: [
                    {
                        info: { role: "user" },
                        parts: [{ type: "text", text: "Please push changes" }]
                    },
                    {
                        info: { role: "assistant" },
                        parts: [
                            { type: "text", text: "I have pushed successfully" }
                            // Note: No toolInvocation part here!
                        ]
                    }
                ]
            } as any

            let error: any
            try {
                await handler(input, output)
            } catch (e) {
                error = e
            }
            expect(error?.message).toContain("[Runtime Enforcement Guard] State claim REJECTED")
        })

        it("should PASS if completion claim is accompanied by the tool call", async () => {
            const ctx = { directory: "/test" } as any
            const hooks = {
                runtimeEnforcement: createRuntimeEnforcementHook(ctx)
            } as any

            const handler = createMessagesTransformHandler({ hooks })

            const input = {} as any
            const output = {
                messages: [
                    {
                        info: { role: "assistant" },
                        parts: [
                            { type: "text", text: "I have pushed successfully" },
                            { type: "toolInvocation", toolName: "git_safe" }
                        ]
                    }
                ]
            } as any

            // Should not throw
            await handler(input, output)
        })
    })

    describe("Plan & Loop Guards (Before Hooks)", () => {
        it("should correctly handle session isolation in loop guard", async () => {
            const ctx = { directory: "/test", client: {} } as any
            const hooks = {
                semanticLoopGuard: createSemanticLoopGuardHook(ctx)
            } as any
            const handler = createToolExecuteBeforeHandler({ ctx, hooks })

            const input = { tool: "ls", sessionID: "ses_loop", callID: "call_a" }
            const output = { args: {} }

            // Pass 3 times
            await handler(input, output)
            await handler(input, output)
            await handler(input, output)

            // 4th time with SAME session should fail
            let error: any
            try {
                await handler(input, output)
            } catch (e) {
                error = e
            }
            expect(error?.message).toContain("[Semantic Loop Guard]")

            // Different session should pass
            const inputNew = { tool: "ls", sessionID: "ses_fresh", callID: "call_b" }
            await handler(inputNew, output)
        })
    })
})
