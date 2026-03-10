import { Command } from "commander"
import { selfAuditLoop } from "./runner"
import type { SelfAuditOptions } from "./types"

export function createSelfAuditCommand(): Command {
  const command = new Command()
    .name("self-audit")
    .description("Repo-wide self-audit looping mode")
    
  command
    .command("loop")
    .description("Start the self-audit loop")
    .option("--resume", "Resume from previous state")
    .option("--function <id>", "Audit specific function by ID")
    .option("--dry-run", "Show what would be audited without making changes")
    .option("--max-iterations <number>", "Maximum iterations to run", parseInt)
    .addHelpText("after", `
Examples:
  $ oh-my-opencode self-audit loop                    # Start full audit loop
  $ oh-my-opencode self-audit loop --resume           # Resume from previous state
  $ oh-my-opencode self-audit loop --dry-run          # Preview only
  $ oh-my-opencode self-audit loop --max-iterations 5  # Limit iterations

Loop behavior:
  - Audits one function per iteration
  - Generates proof reports in docs/self-audit/functions/
  - Commits and pushes to main after each iteration
  - Resumable if interrupted
  - Bounded and stateful

Function categories:
  - runtime: Core plugin runtime logic
  - ui: UI and display logic
  - api: API interfaces and handlers
  - tooling: CLI tools and utilities
  - test-helper: Test utilities and helpers
`)
    .action(async (options) => {
      const auditOptions: SelfAuditOptions = {
        resume: options.resume ?? false,
        functionId: options.function,
        dryRun: options.dryRun ?? false,
        maxIterations: options.maxIterations,
      }
      
      const exitCode = await selfAuditLoop(auditOptions)
      process.exit(exitCode)
    })

  command
    .command("inventory")
    .description("Generate function inventory")
    .option("--refresh", "Force refresh of existing inventory")
    .action(async (options) => {
      const { generateInventory } = await import("./inventory")
      const exitCode = await generateInventory(options.refresh ?? false)
      process.exit(exitCode)
    })

  command
    .command("status")
    .description("Show audit progress and status")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      const { showStatus } = await import("./status")
      const exitCode = await showStatus(options.json ?? false)
      process.exit(exitCode)
    })

  return command
}
