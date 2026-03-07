import { spawnSync } from "bun"

/**
 * Runtime Startup Validation
 * 
 * Ensures all safety-critical dependencies and environment configurations
 * are present before the agent starts executing.
 */

export function validateRuntimeEnvironment() {
    console.log("[Runtime] Validating execution environment...");

    const requirements = [
        { name: "tsc", command: ["which", "tsc"] },
        { name: "typescript-language-server", command: ["which", "typescript-language-server"] },
        { name: "git", command: ["which", "git"] }
    ];

    let missing = [];
    for (const req of requirements) {
        const proc = spawnSync(req.command);
        if (proc.exitCode !== 0) {
            missing.push(req.name);
        }
    }

    if (missing.length > 0) {
        const msg = `[FATAL] Runtime environment missing critical dependencies: ${missing.join(", ")}. Please install them to proceed.`;
        console.error(msg);
        throw new Error(msg);
    }

    // 3. Check for Git
    const gitCheck = spawnSync(["git", "rev-parse", "--is-inside-work-tree"])
    if (gitCheck.exitCode !== 0) {
        throw new Error(
            "FATAL: No git VCS detected. Session changes will not be tracked. " +
            "Please ensure you are running in a valid Git repository root.",
        )
    }

    console.log("[Runtime] Environment layout: VERIFIED.");
}
