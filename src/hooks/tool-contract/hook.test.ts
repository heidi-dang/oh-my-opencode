import { describe, it, expect, mock } from "bun:test"
import { createToolContractHook } from "./hook"

describe("Tool Contract Hook", () => {
    const ctx = { client: {} } as any;
    const hook = createToolContractHook(ctx);
    const executeAfter = hook["tool.execute.after"];

    const sessionID = "test-session";
    const callID = "test-call";

    it("should accept a valid flat boolean payload", async () => {
        const input = { tool: "complete_task", sessionID, callID };
        const output = {
            title: "Task Completed",
            output: "Success",
            metadata: { success: true, verified: true, changedState: false }
        };

        // Should not throw
        await executeAfter(input, output);
    });

    it("should reject missing boolean fields", async () => {
        const input = { tool: "complete_task", sessionID, callID };
        const output = {
            title: "Task Completed",
            output: "Success",
            metadata: { success: true } // missing verified
        };

        await expect(executeAfter(input, output)).rejects.toThrow(/did not return structured boolean metadata/);
    });

    it("should handle string booleans gracefully", async () => {
        const input = { tool: "complete_task", sessionID, callID };
        const output = {
            title: "Task Completed",
            output: "Success",
            metadata: { success: "true", verified: "true", changedState: "false" }
        } as any;

        // Should not throw
        await executeAfter(input, output);
    });

    it("should reject explicit failure", async () => {
        const input = { tool: "verify_action", sessionID, callID };
        const output = {
            title: "Verify Error",
            output: "Failed",
            metadata: { success: false, verified: false, changedState: false }
        };

        await expect(executeAfter(input, output)).rejects.toThrow(/explicitly failed/);
    });

    it("should reject unverified action", async () => {
        const input = { tool: "verify_action", sessionID, callID };
        const output = {
            title: "Verify Result",
            output: "Verification Failed",
            metadata: { success: true, verified: false, changedState: false }
        };

        await expect(executeAfter(input, output)).rejects.toThrow(/Unconfirmed/);
    });

    it("should reject state change without payload", async () => {
        const input = { tool: "fs_safe", sessionID, callID };
        const output = {
            title: "FS Write",
            output: "Written",
            metadata: { success: true, verified: true, changedState: true } // missing stateChange
        };

        await expect(executeAfter(input, output)).rejects.toThrow(/provided no 'stateChange' payload/);
    });
});
