import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createGitSafeTool } from "./git-safe";

describe("git_safe tool verification", () => {
    let tool: any;
    let context: any;
    let mockSpawn: any;
    let capturedMetadata: any[];

    beforeEach(() => {
        mockSpawn = mock();
        tool = createGitSafeTool({ spawn: mockSpawn });
        capturedMetadata = [];
        context = {
            directory: "/tmp/repo",
            metadata: mock((data) => {
                capturedMetadata.push(data);
                return data;
            }),
            callID: "call_123",
            sessionID: "ses_123"
        };
    });

    function createMockProcess(stdout: string, stderr: string, exitCode: number) {
        return {
            stdout: new Response(stdout).body,
            stderr: new Response(stderr).body,
            exited: Promise.resolve(exitCode)
        };
    }

    test("checkout reports verified: true when status matches target", async () => {
        // 1. Initial git checkout call
        mockSpawn.mockReturnValueOnce(createMockProcess("switched to branch 'dev'", "", 0));

        // 2. Proactive git status --porcelain -b check
        mockSpawn.mockReturnValueOnce(createMockProcess("## dev", "", 0));

        await tool.execute({ command: "checkout dev" }, context);

        const meta = capturedMetadata[0];
        expect(meta.verified).toBe(true);
        expect(meta.success).toBe(true);
    });

    test("checkout reports verified: true when HEAD is detached (origin/main)", async () => {
        mockSpawn.mockReturnValueOnce(createMockProcess("", "", 0));
        mockSpawn.mockReturnValueOnce(createMockProcess("## HEAD (no branch)\nHEAD detached at origin/main", "", 0));

        await tool.execute({ command: "checkout origin/main" }, context);

        const meta = capturedMetadata[0];
        expect(meta.verified).toBe(true);
    });

    test("add reports verified: true when files are staged", async () => {
        mockSpawn.mockReturnValueOnce(createMockProcess("", "", 0));
        mockSpawn.mockReturnValueOnce(createMockProcess("file.txt\n", "", 0));

        await tool.execute({ command: "add file.txt" }, context);

        const meta = capturedMetadata[0];
        expect(meta.verified).toBe(true);
    });

    test("fetch reports verified: true by default on success", async () => {
        mockSpawn.mockReturnValueOnce(createMockProcess("", "", 0));

        await tool.execute({ command: "fetch origin" }, context);

        const meta = capturedMetadata[0];
        expect(meta.verified).toBe(true);
    });

    test("failed command reports verified: false", async () => {
        mockSpawn.mockReturnValueOnce(createMockProcess("", "error: pathspec 'invalid' did not match", 1));

        await tool.execute({ command: "checkout invalid" }, context);

        const meta = capturedMetadata[0];
        expect(meta.verified).toBe(false);
        expect(meta.success).toBe(true); 
    });
});
