import { Daytona, Sandbox } from "@daytonaio/sdk";
import type { SandboxProvider, SandboxExecuteResult } from "../types";
import { log } from "../../../shared/logger";

export class DaytonaProvider implements SandboxProvider {
  private client: Daytona;
  private sandboxes: Map<string, Sandbox> = new Map();
  private repoPath = "/home/daytona/project";

  constructor(apiKey: string, apiUrl?: string) {
    this.client = new Daytona({
      apiKey,
      apiUrl
    });
  }

  async create(sessionID: string): Promise<void> {
    if (this.sandboxes.has(sessionID)) return;

    log(`[DaytonaProvider] Creating sandbox for session ${sessionID}`);
    
    // Create a new sandbox for the session
    const sandbox = await this.client.create({
      name: `opencode-${sessionID.substring(0, 8)}`,
      image: "debian:12" // Default image
    });

    this.sandboxes.set(sessionID, sandbox);
    log(`[DaytonaProvider] Sandbox created: ${sandbox.id}`);
  }

  async execute(sessionID: string, command: string, cwd?: string): Promise<SandboxExecuteResult> {
    const sandbox = this.getSandbox(sessionID);
    
    const response = await sandbox.process.executeCommand(
      command,
      cwd || this.repoPath
    );

    return {
      stdout: response.result || "",
      stderr: "", // SDK results combine stdout/stderr in 'result' usually, or check artifacts
      exitCode: response.exitCode || 0
    };
  }

  async readFile(sessionID: string, filePath: string): Promise<string> {
    const sandbox = this.getSandbox(sessionID);
    const fullPath = this.resolvePath(filePath);
    const buffer = await sandbox.fs.downloadFile(fullPath);
    return buffer.toString("utf-8");
  }

  async writeFile(sessionID: string, filePath: string, content: string): Promise<void> {
    const sandbox = this.getSandbox(sessionID);
    const fullPath = this.resolvePath(filePath);
    const buffer = Buffer.from(content, "utf-8");
    await sandbox.fs.uploadFile(buffer, fullPath);
  }

  async destroy(sessionID: string): Promise<void> {
    const sandbox = this.sandboxes.get(sessionID);
    if (sandbox) {
      log(`[DaytonaProvider] Destroying sandbox for session ${sessionID}`);
      await sandbox.delete();
      this.sandboxes.delete(sessionID);
    }
  }

  private getSandbox(sessionID: string): Sandbox {
    const sandbox = this.sandboxes.get(sessionID);
    if (!sandbox) {
      throw new Error(`[DaytonaProvider] No active sandbox for session ${sessionID}`);
    }
    return sandbox;
  }

  private resolvePath(filePath: string): string {
    // Basic mapping for now
    if (filePath.startsWith("/")) return filePath;
    return `${this.repoPath}/${filePath}`;
  }
}
