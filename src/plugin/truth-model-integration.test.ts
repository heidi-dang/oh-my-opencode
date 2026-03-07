import { describe, it, expect, beforeEach } from "bun:test"
import { createToolExecuteBeforeHandler } from "./tool-execute-before"
import { createToolExecuteAfterHandler } from "./tool-execute-after"
import { createMessagesTransformHandler } from "./messages-transform"
import { ledger } from "../runtime/state-ledger"
import { compiler } from "../runtime/plan-compiler"
import { createExecutionJournalHook } from "../hooks/execution-journal/hook"
import { createToolContractHook } from "../hooks/tool-contract/hook"
import { createRuntimeEnforcementHook } from "../hooks/runtime-enforcement/hook"

describe("Authoritative Truth & Flow Isolation Integration", () => {
    beforeEach(() => {
        ledger.clear()
        compiler.submit("", { sessionID: "test" } as any)
    })

    describe("Authoritative Truth (Bash Bypass Prevention)", () => {
        it("should NOT create a verified ledger entry for raw bash commands", async () => {
            const ctx = { directory: "/test", client: {} } as any
            const hooks = {
                executionJournal: createExecutionJournalHook(ctx),
            } as any

            const handler = createToolExecuteAfterHandler({ hooks })

            const input = { tool: "bash", sessionID: "ses_1", callID: "call_bash" }
            const output = {
                title: "Executing bash",
                output: "Commit created on main",
                metadata: {
                    args: { command: "git commit -m 'test'" },
                    success: true
                }
            }

            await handler(input, output)

            // Ledger should be empty because we removed heuristics
            expect(ledger.count).toBe(0)
        })

        it("should ONLY create verified entry if explicit stateChange metadata is present", async () => {
            const ctx = { directory: "/test", client: {} } as any
            const hooks = {
                executionJournal: createExecutionJournalHook(ctx),
            } as any
            const handler = createToolExecuteAfterHandler({ hooks })

            const input = { tool: "git_safe", sessionID: "ses_1", callID: "call_safe" }
            const output = {
                title: "Executing git_safe",
                output: "Success",
                metadata: {
                    success: true,
                    verified: true,
                    changedState: true,
                    stateChange: { type: "git.commit", key: "HEAD" }
                }
            }

            await handler(input, output)
            expect(ledger.count).toBe(1)
            expect(ledger.has("git.commit", "HEAD")).toBe(true)
        })
    })

    describe("Flow Isolation", () => {
        it("should REJECT completion claim if matching tool was called in a PREVIOUS flow (same session)", async () => {
            const ctx = { directory: "/test" } as any
            const hooks = {
                executionJournal: createExecutionJournalHook(ctx),
                runtimeEnforcement: createRuntimeEnforcementHook(ctx)
            } as any

            const transformHandler = createMessagesTransformHandler({ hooks })
            const executeHandler = createToolExecuteAfterHandler({ hooks })

            const sessionID = "ses_flow_test"

            // 1. Flow A: Execute git_safe
            const inputA = { tool: "git_safe", sessionID, callID: "call_a" }
            const outputA = {
                title: "Pushing",
                output: "Success",
                metadata: {
                    success: true,
                    verified: true,
                    changedState: true,
                    stateChange: { type: "git.push", key: "origin" }
                }
            }
            await executeHandler(inputA, outputA)
            expect(ledger.has("git.push", "origin")).toBe(true)

            // 2. Start Flow B (Message Transform)
            // This will call ledger.startNewFlow()
            const transformInput = {} as any
            const transformOutput = {
                messages: [
                    {
                        info: { role: "assistant" },
                        parts: [{ type: "text", text: "Successfully pushed to origin" }]
                        // This is a claim, but 'git_safe' was called in Flow A, not Flow B!
                    }
                ]
            } as any

            let error: any
            try {
                await transformHandler(transformInput, transformOutput)
            } catch (e) {
                error = e
            }

            // Rejection expected because push was in a previous flow
            expect(error?.message).toContain("[Runtime Enforcement Guard] State claim REJECTED")
        })

        it("should PASS completion claim if tool was called in the SAME flow", async () => {
            const ctx = { directory: "/test" } as any
            const hooks = {
                executionJournal: createExecutionJournalHook(ctx),
                runtimeEnforcement: createRuntimeEnforcementHook(ctx)
            } as any

            const transformHandler = createMessagesTransformHandler({ hooks })

            const transformOutput = {
                messages: [
                    {
                        info: { role: "assistant" },
                        parts: [
                            { type: "text", text: "Successfully pushed to origin" },
                            { type: "toolInvocation", toolName: "git_safe" }
                        ]
                    }
                ]
            } as any

            // Should pass
            await transformHandler({}, transformOutput)
        })
    })

    describe("ToolContract Deep Matching", () => {
        it("should REJECT if ledger entry exists but is from BEFORE current flow", async () => {
            const ctx = { directory: "/test", client: {} } as any
            const hooks = {
                toolContract: createToolContractHook(ctx),
            } as any
            const handler = createToolExecuteAfterHandler({ hooks })

            const sessionID = "ses_contract_flow"

            // 1. Record entry manually (older timestamp)
            ledger.record("git.push", "origin", true, true, true, "old", {}, sessionID)

            // 2. Delay to ensure timestamp delta BEFORE flow start
            await new Promise(resolve => setTimeout(resolve, 10))

            // 3. Force new flow
            ledger.startNewFlow()

            // 4. Try to satisfy contract with that old entry
            const input = { tool: "git_safe", sessionID, callID: "call_late" }
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
            expect(error).toBeDefined()
            expect(error?.message).toContain("no matching SUCCESSFUL and VERIFIED entry was found")
        })
    })
})
