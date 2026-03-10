import type { SandboxProvider, SandboxExecuteResult } from "./types";
import { DaytonaProvider } from "./providers/daytona";
import { log } from "../../shared/logger";

export class SandboxManager {
  private providers: Map<string, SandboxProvider> = new Map();
  private activeProvider: string | null = null;
  private sessionProviders: Map<string, string> = new Map();

  constructor() {
    // Default to Daytona if API key is present, can be configured later
    if (process.env.DAYTONA_API_KEY) {
      this.registerProvider("daytona", new DaytonaProvider(process.env.DAYTONA_API_KEY));
      this.activeProvider = "daytona";
    }
  }

  registerProvider(name: string, provider: SandboxProvider) {
    this.providers.set(name, provider);
  }

  async startSessionSandbox(sessionID: string, providerName?: string): Promise<void> {
    const name = providerName || this.activeProvider;
    if (!name) {
      log(`[SandboxManager] No sandbox provider configured for session ${sessionID}`);
      return;
    }

    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`[SandboxManager] Unknown sandbox provider: ${name}`);
    }

    await provider.create(sessionID);
    this.sessionProviders.set(sessionID, name);
    log(`[SandboxManager] Sandbox (${name}) started for session ${sessionID}`);
  }

  async stopSessionSandbox(sessionID: string): Promise<void> {
    const name = this.sessionProviders.get(sessionID);
    if (name) {
      const provider = this.providers.get(name);
      if (provider) {
        await provider.destroy(sessionID);
      }
      this.sessionProviders.delete(sessionID);
      log(`[SandboxManager] Sandbox (${name}) stopped for session ${sessionID}`);
    }
  }

  isSandboxEnabled(sessionID: string): boolean {
    return this.sessionProviders.has(sessionID);
  }

  async execute(sessionID: string, command: string, cwd?: string): Promise<SandboxExecuteResult> {
    const provider = this.getProviderForSession(sessionID);
    return await provider.execute(sessionID, command, cwd);
  }

  async readFile(sessionID: string, filePath: string): Promise<string> {
    const provider = this.getProviderForSession(sessionID);
    return await provider.readFile(sessionID, filePath);
  }

  async writeFile(sessionID: string, filePath: string, content: string): Promise<void> {
    const provider = this.getProviderForSession(sessionID);
    await provider.writeFile(sessionID, filePath, content);
  }

  private getProviderForSession(sessionID: string): SandboxProvider {
    const name = this.sessionProviders.get(sessionID);
    if (!name || !this.providers.has(name)) {
      throw new Error(`[SandboxManager] No active sandbox for session ${sessionID}`);
    }
    return this.providers.get(name)!;
  }
}

export const sandboxManager = new SandboxManager();
