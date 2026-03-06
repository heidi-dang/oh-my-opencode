# Master-Sisyphus Workflow: Discuss, Plan, Execute

The `oh-my-opencode` fork introduces a hierarchical agent workflow inspired by **YGK-a (Your Genius, Knowledgeable assistant)**. This allows you to brainstorm ideas with a high-level architect (Master) before handing off the heavy lifting to the executor (Sisyphus).

## The Agents

### 1. Master (YGK-a)
- **Role**: Strategic Architect & Brilliant Brainstormer.
- **When to use**: When you have a vague idea, need to discuss architectural trade-offs, or want a high-level plan.
- **Constraint**: Master does NOT have file-editing tools. It focuses entirely on planning.

### 2. Sisyphus
- **Role**: Powerful Orchestrator & Executor.
- **When to use**: For implementing features, fixing bugs, and performing complex codebase operations.

---

## The Workflow

### Step 1: Brainstorm with Master
Start a session with the Master agent to discuss your idea.
```bash
oh-my-opencode run --agent master "I want to add a plugin system to my project."
```
Master will discuss the design, suggest patterns, and help you refine the scope.

### Step 2: Formulate a Plan
Once the discussion is complete, ask Master to summarize the implementation plan.

### Step 3: Trigger the Handoff
When you are satisfied with the plan, use a trigger phrase like **"executed plan"** or **"start implementation"**.

**Master will then:**
1.  Package the entire discussion history.
2.  Formulate a detailed prompt for Sisyphus.
3.  Delegate the task to Sisyphus using the `task` tool.

### Step 4: Sisyphus Executes
Sisyphus receives the plan from Master and begins the implementation, using its full suite of tools (file editing, shell execution, etc.).

---

## Why use this?
- **Better Planning**: Prevents "shotgun coding" by forcing a design phase.
- **Context Preservation**: Sisyphus receives a high-quality, pre-digested plan instead of a raw user request.
- **Strategic Handoff**: You can iterate on the "what" with Master until it's perfect, then let Sisyphus handle the "how".
