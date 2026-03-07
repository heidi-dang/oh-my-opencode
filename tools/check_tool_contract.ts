import { DETERMINISTIC_TOOLS } from "../src/runtime/tools/registry";

async function checkTool(name: string) {
    console.log(`Checking tool: ${name}...`);
    try {
        const tool = DETERMINISTIC_TOOLS[name]();

        // Mock context
        const metadataCalls: any[] = [];
        const mockContext = {
            directory: process.cwd(),
            sessionID: "test-session",
            metadata: (meta: any) => metadataCalls.push(meta)
        };

        // Basic mock args - enough to trigger the metadata call in most tools
        // We just want to see the shape of the metadata
        const mockArgs: any = {
            operation: "write",
            filePath: "test.txt",
            content: "test",
            action: "check_git_status", // for verify_action
            steps: [], // for submit_plan
            id: "step1", // for mark_step_complete
            message: "test complete" // for complete_task
        };

        try {
            await tool.execute(mockArgs, mockContext);
        } catch (e) {
            // Some tools might throw if args are invalid, but we only care if they called metadata()
        }

        if (metadataCalls.length === 0) {
            console.error(`[FAIL] ${name} did not call context.metadata()`);
            return false;
        }

        const meta = metadataCalls[0];
        const success = meta.success;
        const verified = meta.verified;
        const changedState = meta.changedState;

        if (typeof success !== 'boolean' || typeof verified !== 'boolean' || (name !== 'verify_action' && typeof changedState !== 'boolean')) {
            console.error(`[FAIL] ${name} returned invalid metadata shape:`, JSON.stringify(meta));
            return false;
        }

        console.log(`[PASS] ${name} metadata shape is valid.`);
        return true;
    } catch (err) {
        console.error(`[ERROR] Failed to check ${name}:`, err);
        return false;
    }
}

async function main() {
    const tools = ["git_safe", "fs_safe", "verify_action", "submit_plan", "mark_step_complete", "query_ledger", "complete_task"];
    let allPass = true;

    for (const t of tools) {
        if (!await checkTool(t)) {
            allPass = false;
        }
    }

    if (!allPass) {
        process.exit(1);
    }
    console.log("\nAll safety tool contracts verified.");
}

main();
