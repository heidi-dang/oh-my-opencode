import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { compiler } from "../../runtime/plan-compiler"
import { createPlanEnforcementHook, PlanCompilerGuardError } from "./hook"

describe("Plan Enforcement Hook", () => {
    let hook: ReturnType<typeof createPlanEnforcementHook>

    beforeEach(() => {
        hook = createPlanEnforcementHook({} as any)
        // Reset compiler state
        compiler.submit([] as any, { sessionID: "test" } as any)
    })

    afterEach(() => {
        // Clean up after each test
        compiler.submit([] as any, { sessionID: "test" } as any)
    })

    describe("No active step", () => {
        it("should allow all tools when no plan is active", async () => {
            const input = { tool: "any_tool", sessionID: "test", callID: "test" }
            await expect(hook["tool.execute.before"](input, { args: {} })).resolves.toBeUndefined()
        })
    })

    describe("Active step with allowed tools", () => {
        beforeEach(() => {
            compiler.submit([{
                id: "1",
                action: "Fix model-resolver tests to pass in full test suite",
                dependencies: []
            }] as any, { sessionID: "test" } as any)
        })

        const allowedTools = [
            "mark_step_complete",
            "verify_action",
            "submit_plan",
            "query_ledger",
            "complete_task",
            "grep",
            "glob",
            "ast_grep",
            "lsp_symbols",
            "lsp_goto_definition",
            "lsp_find_references",
            "edit",
            "lsp_rename",
            "lsp_prepare_rename",
            "fs_safe",
            "git_safe",
            "task_create",
            "task_get",
            "task_list",
            "task_update",
            "task",
            "lsp_diagnostics",
            "background_output",
            "background_cancel",
            "interactive_bash",
            "call_omo_agent",
            "skill",
            "skill_mcp",
            "session_manager_create",
            "session_manager_list",
            "session_manager_switch",
            "look_at"
        ]

        it.each(allowedTools)("should allow essential tool: %s", async (tool) => {
            const input = { tool, sessionID: "test", callID: "test" }
            await expect(hook["tool.execute.before"](input, { args: {} })).resolves.toBeUndefined()
        })

        it("should allow tools that match the step action", async () => {
            const input = { tool: "fix", sessionID: "test", callID: "test" }
            await expect(hook["tool.execute.before"](input, { args: {} })).resolves.toBeUndefined()
        })
    })

    describe("Active step with blocked tools", () => {
        beforeEach(() => {
            compiler.submit([{
                id: "1",
                action: "Fix model-resolver tests to pass in full test suite",
                dependencies: []
            }] as any, { sessionID: "test" } as any)
        })

        const blockedTools = [
            "unrelated_tool",
            "random_action",
            "invalid_command"
        ]

        it.each(blockedTools)("should block unrelated tool: %s", async (tool) => {
            const input = { tool, sessionID: "test", callID: "test" }

            let error: PlanCompilerGuardError | undefined
            try {
                await hook["tool.execute.before"](input, { args: {} })
            } catch (e) {
                error = e as PlanCompilerGuardError
            }

            expect(error).toBeInstanceOf(PlanCompilerGuardError)
            expect(error?.activeStepId).toBe("1")
            expect(error?.activeStepAction).toBe("Fix model-resolver tests to pass in full test suite")
            expect(error?.requestedTool).toBe(tool)
            expect(error?.allowedTools).toContain("grep")
            expect(error?.allowedTools).toContain("edit")
            expect(error?.reason).toContain("not in always-allowed list")
        })
    })

    describe("Error logging", () => {
        beforeEach(() => {
            compiler.submit([{
                id: "1",
                action: "Fix model-resolver tests to pass in full test suite",
                dependencies: []
            }] as any, { sessionID: "test" } as any)
        })

        it("should log guard decisions", async () => {
            const consoleLog = mock(() => {})
            const originalConsoleLog = console.log
            console.log = consoleLog

            const input = { tool: "blocked_tool", sessionID: "test", callID: "test" }

            try {
                await hook["tool.execute.before"](input, { args: {} })
            } catch {
                // Expected
            }

            expect(consoleLog).toHaveBeenCalledWith(
                "[Plan Compiler Guard] Blocking tool call",
                expect.objectContaining({
                    activeStepId: "1",
                    activeStepAction: "Fix model-resolver tests to pass in full test suite",
                    requestedTool: "blocked_tool",
                    reason: "Tool does not match active step intent and is not in always-allowed list"
                })
            )

            console.log = originalConsoleLog
        })
    })

    describe("Missing plan state fallback", () => {
        it("should not create deadlock when plan state is corrupted", async () => {
            // Simulate corrupted state by setting invalid graph
            ;(compiler as any).graph = null
            ;(compiler as any).currentStepIndex = 0

            const input = { tool: "any_tool", sessionID: "test", callID: "test" }
            // Should not throw, allowing fallback to freestyle mode
            await expect(hook["tool.execute.before"](input, { args: {} })).resolves.toBeUndefined()
        })
    })
})