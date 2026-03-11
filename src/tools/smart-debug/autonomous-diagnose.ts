import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";
import { diagnosticEngine } from "../../features/smart-debug";

export function createAutonomousDiagnoseTool(): ToolDefinition {
  return tool({
    description: "Autonomous high-level diagnostic suite for Heidi-PRO. Runs system doctor, sifts through logs for errors, and checks TypeScript typecheck status. Use this FIRST when the user says 'debug' or 'find bug'.",
    args: {},
    execute: async () => {
      const results = await diagnosticEngine.runFullAudit();
      
      let report = "# Heidi-PRO Autonomous Diagnostic Report\n\n";
      
      for (const res of results) {
        const icon = res.status === "pass" ? "✅" : res.status === "fail" ? "❌" : "⚠️";
        report += `## ${icon} ${res.category.toUpperCase()}\n`;
        report += `**Status:** ${res.status}\n`;
        report += `**Message:** ${res.message}\n`;
        if (res.details) {
          report += `\n<details>\n<summary>Technical Details</summary>\n\n\`\`\`\n${res.details}\n\`\`\`\n</details>\n\n`;
        }
        report += "---\n";
      }

      report += "\n**Next Steps:** Based on these results, I will now proceed to investigate the specific failures or proceed with manual debugging if the system appears healthy.";
      
      return report;
    },
  });
}
