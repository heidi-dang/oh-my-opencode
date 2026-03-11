export interface SandboxExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxProvider {
  /**
   * Initialize a sandbox for the given session.
   */
  create(sessionID: string): Promise<void>;

  /**
   * Execute a command in the sandbox.
   */
  execute(sessionID: string, command: string, cwd?: string): Promise<SandboxExecuteResult>;

  /**
   * Read a file from the sandbox.
   */
  readFile(sessionID: string, filePath: string): Promise<string>;

  /**
   * Write a file to the sandbox.
   */
  writeFile(sessionID: string, filePath: string, content: string): Promise<void>;

  /**
   * Cleanup the sandbox.
   */
  destroy(sessionID: string): Promise<void>;
}
