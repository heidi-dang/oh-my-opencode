import { exec } from "child_process";
import { promisify } from "util";
import { log } from "../../shared/logger";
import { readFile } from "fs/promises";

const execAsync = promisify(exec);

export interface DiagnosticResult {
  category: "doctor" | "logs" | "typecheck";
  status: "pass" | "fail" | "warning";
  message: string;
  details?: string;
}

export class DiagnosticEngine {
  async runFullAudit(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    // 1. Run Doctor
    try {
      log("[DiagnosticEngine] Running system doctor...");
      const { stdout } = await execAsync("bunx oh-my-opencode doctor --json");
      const doctorData = JSON.parse(stdout);
      const isHealthy = doctorData.status === "healthy" || doctorData.status === "success";
      
      results.push({
        category: "doctor",
        status: isHealthy ? "pass" : "fail",
        message: isHealthy ? "System doctor reported healthy state." : "System doctor found issues.",
        details: stdout
      });
    } catch (error: any) {
      results.push({
        category: "doctor",
        status: "fail",
        message: "Failed to run system doctor.",
        details: error.message
      });
    }

    // 2. Check Logs
    try {
      log("[DiagnosticEngine] Sifting logs...");
      const logContent = await readFile("/tmp/oh-my-opencode.log", "utf-8");
      const lines = logContent.split("\n").reverse().slice(0, 100);
      const errorLines = lines.filter(line => 
        line.includes("ERROR") || 
        line.includes("UnhandledRejection") || 
        line.includes("uncaughtException")
      );

      if (errorLines.length > 0) {
        results.push({
          category: "logs",
          status: "fail",
          message: `Found ${errorLines.length} recent errors in system logs.`,
          details: errorLines.join("\n")
        });
      } else {
        results.push({
          category: "logs",
          status: "pass",
          message: "No critical errors found in recent logs."
        });
      }
    } catch (error: any) {
       results.push({
        category: "logs",
        status: "warning",
        message: "Could not read system logs.",
        details: error.message
      });
    }

    // 3. Typecheck
    try {
      log("[DiagnosticEngine] Running typecheck...");
      // We run a fast typecheck on the src directory
      await execAsync("bun run typecheck");
      results.push({
        category: "typecheck",
        status: "pass",
        message: "TypeScript typecheck passed."
      });
    } catch (error: any) {
      results.push({
        category: "typecheck",
        status: "fail",
        message: "TypeScript typecheck failed.",
        details: error.stdout || error.message
      });
    }

    return results;
  }
}

export const diagnosticEngine = new DiagnosticEngine();
