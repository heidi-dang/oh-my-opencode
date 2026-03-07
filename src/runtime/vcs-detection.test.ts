import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "bun";
import { validateRuntimeEnvironment } from "./startup-validation";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("VCS Detection", () => {
    let tmpDir: string;
    const originalCwd = process.cwd();

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vcs-test-"));
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should pass when in a valid git repository", () => {
        process.chdir(tmpDir);
        spawnSync(["git", "init"]);
        fs.writeFileSync("test.txt", "hello");
        spawnSync(["git", "add", "."]);
        spawnSync(["git", "commit", "-m", "initial commit"]);

        // Should not throw
        expect(() => validateRuntimeEnvironment()).not.toThrow();
    });

    it("should pass when in a subfolder of a git repository", () => {
        process.chdir(tmpDir);
        spawnSync(["git", "init"]);
        fs.mkdirSync("subdir");
        process.chdir("subdir");

        // Should not throw
        expect(() => validateRuntimeEnvironment()).not.toThrow();
    });

    it("should throw when not in a git repository", () => {
        process.chdir(tmpDir);
        // No git init here

        expect(() => validateRuntimeEnvironment()).toThrow(/No git VCS detected/);
    });

    it("should throw when git is missing (simulated by non-repo)", () => {
        process.chdir(tmpDir);
        // Even if git is installed, if it's not a repo, it should fail with the VCS message
        expect(() => validateRuntimeEnvironment()).toThrow(/No git VCS detected/);
    });
});
