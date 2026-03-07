export interface ExecutionGraphNode {
    id: string
    action: string      // e.g. "run_tests", "fix", "commit"
    dependencies: string[]
    status: "pending" | "running" | "completed" | "failed"
}

interface SessionState {
    graph: ExecutionGraphNode[]
    currentStepIndex: number
    taskID: string
}

export class PlanCompiler {
    private static instance: PlanCompiler
    private sessionStates: Map<string, SessionState> = new Map()

    private constructor() { }

    public static getInstance(): PlanCompiler {
        if (!PlanCompiler.instance) {
            PlanCompiler.instance = new PlanCompiler()
        }
        return PlanCompiler.instance
    }

    public submit(sessionID: string, steps: Omit<ExecutionGraphNode, "status">[]): string {
        const taskID = Math.random().toString(36).substring(7)
        const graph = this.injectVerificationDependencies(
            steps.map(n => ({ ...n, status: "pending" as const }))
        )

        this.sessionStates.set(sessionID, {
            graph,
            currentStepIndex: 0,
            taskID
        })

        return taskID
    }

    public getActiveStep(sessionID: string): ExecutionGraphNode | null {
        const state = this.sessionStates.get(sessionID)
        if (!state) return null

        if (state.currentStepIndex >= 0 && state.currentStepIndex < state.graph.length) {
            return state.graph[state.currentStepIndex]
        }
        return null
    }

    public markStepComplete(sessionID: string, id: string): void {
        const state = this.sessionStates.get(sessionID)
        if (!state) return

        const node = state.graph.find(n => n.id === id)
        if (node) {
            node.status = "completed"
            state.currentStepIndex++
            
            // Auto-clear once complete
            if (state.currentStepIndex >= state.graph.length) {
                this.clear(sessionID)
            }
        }
    }

    public injectForcedReplan(sessionID: string, reason: string): void {
        const state = this.sessionStates.get(sessionID)
        if (!state) return

        const active = this.getActiveStep(sessionID)
        if (active) {
            active.status = "failed"
        }

        // Wipe the future graph and inject a mandatory replan
        this.submit(sessionID, [
            {
                id: "forced_replan_" + Date.now(),
                action: "submit_plan",
                dependencies: []
            }
        ])
    }

    public clear(sessionID: string): void {
        this.sessionStates.delete(sessionID)
    }

    public resetAll(): void {
        this.sessionStates.clear()
    }

    private injectVerificationDependencies(nodes: ExecutionGraphNode[]): ExecutionGraphNode[] {
        const compiled: typeof nodes = []

        // Simplistic macro expansion: For every 'commit' or 'push' or 'fix', 
        // inject a verification step immediately after it.
        for (const node of nodes) {
            compiled.push(node)

            if (node.action.includes("commit") || node.action.includes("push") || node.action.includes("fix")) {
                compiled.push({
                    id: `${node.id}_verify`,
                    action: "verify_action",
                    dependencies: [node.id],
                    status: "pending"
                })
            }
        }
        return compiled
    }
}

export const compiler = PlanCompiler.getInstance()
