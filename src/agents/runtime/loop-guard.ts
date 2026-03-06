/**
 * Anti-loop protection for agent orchestration.
 *
 * Prevents infinite recursion, excessive agent spawning,
 * and runaway tool usage by imposing hard limits.
 * These limits are injected into orchestrator agent prompts
 * as mandatory constraints.
 */

export interface LoopGuardConfig {
    /** Maximum depth of nested agent delegations (agent calling agent calling agent...) */
    maxAgentDepth: number
    /** Maximum total agent invocations across entire task */
    maxAgentCalls: number
    /** Maximum total tool calls before mandatory progress check */
    maxToolCalls: number
}

export const DEFAULT_LOOP_GUARD: LoopGuardConfig = {
    maxAgentDepth: 4,
    maxAgentCalls: 12,
    maxToolCalls: 30,
}

/**
 * Builds a prompt section that enforces anti-loop constraints.
 * Injected into orchestrator agents (Sisyphus, Atlas, Hephaestus).
 */
export function buildLoopGuardSection(config: LoopGuardConfig = DEFAULT_LOOP_GUARD): string {
    return `## Anti-Loop Protection (MANDATORY)

<loop_guard>
**Hard limits to prevent infinite recursion and runaway execution:**

- **Max agent delegation depth**: ${config.maxAgentDepth} levels (agent → agent → agent → agent = MAX)
- **Max total agent calls per task**: ${config.maxAgentCalls} (across all delegation chains)
- **Max tool calls without progress**: ${config.maxToolCalls} (must show measurable progress)

**When ANY limit is reached:**
1. STOP all further delegation/tool calls immediately
2. Summarize progress made so far
3. List what remains incomplete
4. Return partial result to user with clear status

**Progress is defined as:**
- File successfully modified (verified by lsp_diagnostics)
- Test passing that previously failed
- Build succeeding that previously failed
- Verified command output showing changed state

**NOT progress:**
- Re-reading the same files
- Re-running the same failed command
- Delegating the same task to another agent
- Searching for the same pattern with different queries

**Anti-loop rules:**
- If the same tool call appears 3+ times with identical arguments → STOP. You are looping.
- If 2+ agents return the same error for the same task → STOP. Escalate to user.
- If delegation depth reaches ${config.maxAgentDepth} → STOP. Solve at current level or report.
</loop_guard>`
}
