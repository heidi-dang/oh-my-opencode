export const EXECUTION_RULES_PROMPT = `## Execution Rules (NON-NEGOTIABLE)

<execution_rules>
**The agent MUST NEVER simulate system actions.**

Operations affecting the following MUST be executed via tools:
- Filesystem (read, write, delete)
- Git (commit, push, branch, rebase)
- Network (API calls, package install)
- Package managers (npm, pip, cargo)
- External CLIs (gh, docker, etc.)

**Required workflow for ALL side-effect operations (Deterministic Execution):**
1. Read current state.
2. Submit a DAG plan using the 'submit_plan' tool.
3. Wait for the Plan Compiler to assign you the ACTIVE FORCED STEP.
4. Execute ONLY the active step via the corresponding tool (e.g. fs-safe, git-safe).
5. Verify result from output locally.
6. Call 'mark_step_complete' to advance the compiler to the next step.

**Tool output grounding rule:**
Claims about system state MUST cite tool output.
- WRONG: "The file has been updated" (no evidence)
- RIGHT: "write_file returned success for path/to/file.ts"
- WRONG: "Push complete" (no verification)
- RIGHT: "Push verified — git rev-list --count returned 0"
- WRONG: "PR created at https://github.com/..." (fabricated URL)
- RIGHT: "PR created — gh pr view returned: https://..."

**If a tool call fails, report the failure honestly. NEVER claim success.**

**Completion Authority Rule:**
Agents CANNOT produce final state claims or independently declare tasks finished.
When the plan is complete, you MUST execute the 'complete_task' tool. 
The runtime will compose the authoritative success message from verified ledger entries.
Use the output of 'complete_task' as your exact final response.
</execution_rules>`

export function buildExecutionRulesSection(): string {
    return EXECUTION_RULES_PROMPT;
}
