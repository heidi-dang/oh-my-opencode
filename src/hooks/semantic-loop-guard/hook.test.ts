import { describe, it, expect, beforeEach } from "bun:test";
import { createSemanticLoopGuardHook } from "./hook";
import { ledger } from "../../runtime/state-ledger";
import { compiler } from "../../runtime/plan-compiler";

describe("Semantic Loop Guard Recovery", () => {
    beforeEach(() => {
        // Reset singleton states
        // @ts-ignore accessing private for test reset
        compiler.graph = [];
        // @ts-ignore
        compiler.currentStepIndex = -1;

        // Clear ledger
        // @ts-ignore
        ledger.entries = [];
    });

    it("should block after 3 repeated actions and inject a forced replan", async () => {
        const sessionID = "test-session";
        const toastCalls: any[] = [];
        const mockCtx = {
            client: {
                tui: {
                    showToast: async (payload: any) => {
                        toastCalls.push(payload);
                    }
                }
            }
        };

        const hook = createSemanticLoopGuardHook(mockCtx as any);

        const tool = "bash_safe";
        const args = { command: "ls -la" };

        // 1st attempt
        await hook["tool.execute.before"]({ tool, sessionID, callID: "1" }, { args });

        // 2nd attempt
        await hook["tool.execute.before"]({ tool, sessionID, callID: "2" }, { args });

        // 3rd attempt
        await hook["tool.execute.before"]({ tool, sessionID, callID: "3" }, { args });

        // 4th attempt should throw and trigger recovery
        let thrownError: Error | null = null;
        try {
            await hook["tool.execute.before"]({ tool, sessionID, callID: "4" }, { args });
        } catch (e: any) {
            thrownError = e;
        }

        expect(thrownError).not.toBeNull();
        expect(thrownError?.message).toContain("[Semantic Loop Guard]");
        expect(thrownError?.message).toContain("blocked for safety");

        // Verify Green Toast was shown
        expect(toastCalls.length).toBe(1);
        expect(toastCalls[0].body.variant).toBe("success");
        expect(toastCalls[0].body.title).toBe("Safety Guard Active");

        // Verify compiler has a forced replan step
        const activeStep = compiler.getActiveStep();
        expect(activeStep).not.toBeNull();
        expect(activeStep?.action).toBe("submit_plan");
        expect(activeStep?.id).toContain("forced_replan_");
    });
});
