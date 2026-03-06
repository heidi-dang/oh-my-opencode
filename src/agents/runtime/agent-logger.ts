/**
 * Agent Logger
 * 
 * Provides structured observability for the deterministic deterministic agent pipeline.
 * Formats lifecycle events: agent start, tool execution, delegation, completion.
 */

export const AgentLogger = {
    logAgentStart: (agentName: string, goal: string) => {
        console.log(`\n============================================================`)
        console.log(`[agent] ${agentName}`)
        console.log(`[goal]  ${goal.slice(0, 100)}${goal.length > 100 ? '...' : ''}`)
        console.log(`============================================================\n`)
    },

    logToolCall: (toolName: string, args: Record<string, any>) => {
        console.log(`[tool]  ${toolName}`)
        // Suppress heavy arguments like file contents or large code blocks for the stdout
        const displayArgs = { ...args }
        if (displayArgs.content && typeof displayArgs.content === 'string' && displayArgs.content.length > 200) {
            displayArgs.content = `<content: ${displayArgs.content.length} chars>`
        }
        console.log(`[args]  ${JSON.stringify(displayArgs)}`)
    },

    logToolResult: (success: boolean, summary: string) => {
        const status = success ? 'SUCCESS' : 'FAILED'
        console.log(`[result] [${status}] ${summary.slice(0, 150)}${summary.length > 150 ? '...' : ''}\n`)
    },

    logVerification: (verified: boolean, details: string) => {
        const status = verified ? 'VERIFIED' : 'UNVERIFIED'
        console.log(`[verify] [${status}] ${details}\n`)
    },

    logDelegation: (fromAgent: string, toAgent: string, task: string) => {
        console.log(`\n>>> [delegate] ${fromAgent} -> ${toAgent}`)
        console.log(`>>> [task]     ${task}\n`)
    },

    logCompletion: (agentName: string, result: string) => {
        console.log(`\n============================================================`)
        console.log(`[complete] ${agentName} finished execution.`)
        console.log(`[report]   ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`)
        console.log(`============================================================\n`)
    },

    logAbort: (reason: string) => {
        console.error(`\n[ABORT] Execution terminology halted: ${reason}\n`)
    }
}
