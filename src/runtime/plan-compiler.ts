export interface ExecutionGraphNode {
    id: string
    action: string      // e.g. "run_tests", "fix", "commit"
    dependencies: string[]
    status: "pending" | "running" | "completed" | "failed"
}

export class PlanCompiler {
    private static instance: PlanCompiler
    private graph: ExecutionGraphNode[] = []
    private currentStepIndex: number = -1

    private constructor() { }

    public static getInstance(): PlanCompiler {
        if (!PlanCompiler.instance) {
            PlanCompiler.instance = new PlanCompiler()
        }
        return PlanCompiler.instance
    }

    public submit(planNodes: Omit<ExecutionGraphNode, "status">[]): void {
        this.graph = planNodes.map(n => ({ ...n, status: "pending" }))

        // Automatically inject implicit verification nodes
        this.graph = this.injectVerificationDependencies(this.graph)
        this.currentStepIndex = 0
    }

    public getActiveStep(): ExecutionGraphNode | null {
        if (this.currentStepIndex >= 0 && this.currentStepIndex < this.graph.length) {
            return this.graph[this.currentStepIndex]
        }
        return null
    }

    public markStepComplete(id: string): void {
        const node = this.graph.find(n => n.id === id)
        if (node) {
            node.status = "completed"
            this.currentStepIndex++
        }
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
