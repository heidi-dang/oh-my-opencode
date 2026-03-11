import type { SandboxProvider, SandboxExecuteResult } from "./types";
import { DaytonaProvider } from "./providers/daytona";
import { log } from "../../shared/logger";
import { getMainSessionID } from "../claude-code-session-state";
import * as path from "path";
import * as fs from "fs";
import type { SandboxConfig } from "../../config/schema/sandbox";

import type { Plugin, ToolDefinition } from "@opencode-ai/plugin";

/**
 * Interface matching the @opencode-ai/plugin tool context
 */
type ToolContext = Parameters<ToolDefinition["execute"]>[1];

/**
 * Signature for tool execute function
 */
type ToolExecuteFunc = ToolDefinition["execute"];

export class SandboxManager {
  private providers: Map<string, SandboxProvider> = new Map();
  private activeProvider: string | null = null;
  private sessionProviders: Map<string, string> = new Map();
  private config: SandboxConfig | null = null;
  private hostBaseDir: string = "";

  constructor() {
    // We'll initialize properly when config is set
  }

  public setConfig(config: SandboxConfig, projectDir: string) {
    this.config = config;
    this.hostBaseDir = path.join(projectDir, ".opencode", "sandbox");
    
    // Ensure host base dir exists
    if (!fs.existsSync(this.hostBaseDir)) {
      fs.mkdirSync(this.hostBaseDir, { recursive: true });
      log(`[SandboxManager] Created sandbox host base directory: ${this.hostBaseDir}`);
    }

    if (config.enabled && config.daytona_api_key) {
      this.registerProvider("daytona", new DaytonaProvider(config.daytona_api_key, config.daytona_server_url));
      this.activeProvider = "daytona";
      log(`[SandboxManager] Daytona provider registered as active`);
    } else if (process.env.DAYTONA_API_KEY) {
      this.registerProvider("daytona", new DaytonaProvider(process.env.DAYTONA_API_KEY));
      this.activeProvider = "daytona";
      log(`[SandboxManager] Daytona provider registered via environment`);
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

    // Respect session_control
    if (this.config?.session_control === "never") {
      log(`[SandboxManager] Session control is 'never', skipping sandbox for ${sessionID}`);
      return;
    }

    if (this.config?.session_control === "manual" && !providerName) {
       log(`[SandboxManager] Session control is 'manual' and no provider requested, skipping sandbox for ${sessionID}`);
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
        await provider.destroy(sessionID).catch(err => {
           log(`[SandboxManager] Error destroying remote sandbox for ${sessionID}:`, err);
        });
      }
      this.sessionProviders.delete(sessionID);
      log(`[SandboxManager] Sandbox (${name}) stopped for session ${sessionID}`);
    }

    // Strict host-side cleanup
    const sessionDir = this.getSessionHostDir(sessionID);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        log(`[SandboxManager] Cleaned up host storage for session ${sessionID}: ${sessionDir}`);
      } catch (err) {
        log(`[SandboxManager] Failed to clean up host storage for ${sessionID}:`, err);
      }
    }
  }

  public getSessionHostDir(sessionID: string): string {
    return path.join(this.hostBaseDir, sessionID);
  }

  public enableSandboxForSession(sessionID: string, providerName?: string) {
    return this.startSessionSandbox(sessionID, providerName);
  }

  public disableSandboxForSession(sessionID: string) {
    return this.stopSessionSandbox(sessionID);
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

  /**
   * Transparently wraps a tool's execute function to redirect to the sandbox if enabled.
   */
  public wrapTool(name: string, definition: ToolDefinition): ToolDefinition {
    if (!definition || typeof definition.execute !== "function") {
      log(`[SandboxManager] WARNING: tool '${name}' has no valid definition (${typeof definition}), returning passthrough`);
      return definition;
    }
    const originalExecute = definition.execute;

    return {
      ...definition,
      execute: async (args: any, context: ToolContext) => {
      // 1. Identify session ID (prefer context, fallback to main)
      const sessionID = context?.sessionID || getMainSessionID();
      
      if (!sessionID || !this.isSandboxEnabled(sessionID)) {
        return originalExecute(args, context);
      }

      log(`[SandboxManager] Redirecting tool '${name}' to sandbox for session ${sessionID}`);

      try {
        // 2. Redirect based on tool name pattern
        if (name === "bash" || name === "interactive_bash" || name === "git_safe") {
          const command = args.command || args.tmux_command || args.git_command;
          if (command) {
            const result = await this.execute(sessionID, command, context.directory);
            if (result.exitCode !== 0) {
              return `Error: ${result.stderr || result.stdout || `Command failed with exit code ${result.exitCode}`}`;
            }
            return result.stdout || "(no output)";
          }
        }

        if (name === "fs_safe") {
          const { operation, filePath, content } = args;
          if (operation === "write") {
            await this.writeFile(sessionID, filePath, content || "");
          } else if (operation === "mkdir") {
            await this.execute(sessionID, `mkdir -p ${filePath}`);
          } else if (operation === "delete") {
            await this.execute(sessionID, `rm -rf ${filePath}`);
          }
          return `Successfully executed ${operation} on ${filePath} in sandbox`;
        }

        if (name === "read_file" || name === "view_file" || name === "read" || name === "batch_read") {
          const path = args.path || args.filePath || args.AbsolutePath || args.paths?.[0];
          if (path) {
            return await this.readFile(sessionID, path);
          }
        }

        if (name.includes("grep") || name.includes("ls") || name.includes("glob")) {
          // General redirection for search tools via sandbox shell execution
          // This is a fallback if specific redirections aren't implemented
          log(`[SandboxManager] Generic redirection for ${name} via sandbox shell`);
          // Note: This might need more specific handling for complex args
        }
      } catch (err: any) {
        log(`[SandboxManager] Redirection error for ${name}:`, err);
        return `Sandbox Error: ${err.message}`;
      }

      // Fallback to local if redirection logic for this specific tool is missing or fails
      return originalExecute(args, context);
    }
  };
}
}

export const sandboxManager = new SandboxManager();
