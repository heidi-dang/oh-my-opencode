import { ledger } from "../../runtime/state-ledger"

/**
 * Context Builder
 * 
 * Assembles highly minimal prompt context by lazy-loading only necessary 
 * skills and summarizing historical execution ledger.
 */

export const ContextBuilder = {
    /**
     * Summarizes the execution ledger history to prevent context window bloat.
     * Only includes the last N steps with truncated outputs.
     */
    summarizeLedger: (maxSteps: number = 5): string => {
        const allEntries = ledger.getEntries()
        if (allEntries.length === 0) return "Ledger is empty. No previous actions taken."

        const recent = allEntries.slice(-maxSteps)
        return recent.map((entry: any, index: number) => {
            return `Step ${allEntries.length - maxSteps + index + 1} | Tool: ${entry.type} | Target: ${entry.key}`
        }).join('\n')
    },

    /**
     * Lazily injects only the specialized skill rules needed for the current context.
     * Do not pack the prompt with all known tool schemas.
     */
    activeSkillContext: (agentRole: string, requestedSkills: string[] = []): string => {
        const loaded: string[] = []

        if (requestedSkills.includes("git")) {
            loaded.push(`[Git Skills]\navailable: git_safe\nverify: Yes (use query_ledger to confirm)`)
        }

        if (requestedSkills.includes("fs")) {
            loaded.push(`[FS Skills]\navailable: fs_safe\nrules: Read file before writing.`)
        }

        if (loaded.length === 0) return ""

        return `\n<ActiveSkills>\n${loaded.join('\n\n')}\n</ActiveSkills>`
    },

    /**
     * Constructs the final token-efficient prompt string tailored for the current turn.
     */
    buildPrompt: (baseSystemPrompt: string, agentRoleProfile: string, currentGoal: string, requestedSkills: string[] = []): string => {
        return [
            baseSystemPrompt,
            agentRoleProfile,
            `\n## Current Goal\n${currentGoal}`,
            `\n## Recent Execution Ledger\n${ContextBuilder.summarizeLedger(5)}`,
            ContextBuilder.activeSkillContext(agentRoleProfile, requestedSkills)
        ].filter(Boolean).join('\n')
    }
}
