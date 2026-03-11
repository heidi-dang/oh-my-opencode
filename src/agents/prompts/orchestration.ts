import type { AvailableAgent, AvailableTool, AvailableSkill, AvailableCategory } from "../types"

export function categorizeTools(toolNames: string[]): AvailableTool[] {
    return toolNames.map((name) => {
        let category: AvailableTool["category"] = "other"
        if (name.startsWith("lsp_")) {
            category = "lsp"
        } else if (name.startsWith("ast_grep")) {
            category = "ast"
        } else if (name === "grep" || name === "glob" || name === "batch_grep" || name === "batch_read" || name === "search_symbols") {
            category = "search"
        } else if (name.startsWith("session_")) {
            category = "session"
        } else if (name === "skill") {
            category = "command"
        } else if (name === "multi_replace_file_content") {
            category = "edit"
        }
        return { name, category }
    })
}

function formatToolsForPrompt(tools: AvailableTool[]): string {
    const lspTools = tools.filter((t) => t.category === "lsp")
    const astTools = tools.filter((t) => t.category === "ast")
    const searchTools = tools.filter((t) => t.category === "search")

    const parts: string[] = []

    if (searchTools.length > 0) {
        parts.push("`batch_read`, `batch_grep`, `search_symbols`")
    }

    if (lspTools.length > 0) {
        parts.push("`lsp_*`")
    }

    if (astTools.length > 0) {
        parts.push("`ast_grep`")
    }

    if (tools.some(t => t.name === "multi_replace_file_content")) {
        parts.push("`multi_replace_file_content`")
    }

    return parts.join(", ")
}

export function buildKeyTriggersSection(agents: AvailableAgent[], _skills: AvailableSkill[] = []): string {
    const keyTriggers = agents
        .filter((a) => a.metadata.keyTrigger)
        .map((a) => `- ${a.metadata.keyTrigger}`)

    if (keyTriggers.length === 0) return ""

    return `### Key Triggers (check BEFORE classification):

${keyTriggers.join("\n")}
- **"Look into" + "create PR"** → Not just research. Full implementation cycle expected.`
}

export function buildToolSelectionTable(
    agents: AvailableAgent[],
    tools: AvailableTool[] = [],
    _skills: AvailableSkill[] = []
): string {
    const rows: string[] = [
        "### Tool & Agent Selection:",
        "",
    ]

    if (tools.length > 0) {
        const toolsDisplay = formatToolsForPrompt(tools)
        rows.push(`- ${toolsDisplay} — **FREE** — Not Complex, Scope Clear, No Implicit Assumptions`)
    }

    const costOrder = { FREE: 0, CHEAP: 1, EXPENSIVE: 2 }
    const sortedAgents = [...agents]
        .filter((a) => a.metadata.category !== "utility")
        .sort((a, b) => costOrder[a.metadata.cost] - costOrder[b.metadata.cost])

    for (const agent of sortedAgents) {
        const shortDesc = agent.description.split(".")[0] || agent.description
        rows.push(`- \`${agent.name}\` agent — **${agent.metadata.cost}** — ${shortDesc}`)
    }

    rows.push("")
    rows.push("**Default flow**: explore/librarian (background) + tools → oracle (if required)")
    rows.push("")
    rows.push("### Batch & Bulk Efficiency (Performance Hardening):")
    rows.push("- Use `batch_read` and `batch_grep` to minimize round-trips during research.")
    rows.push("- Use `multi_replace_file_content` for complex or non-contiguous edits in a single turn.")
    rows.push("- High-speed navigation: Always prefer `search_symbols` for finding definitions before falling back to `grep`.")
    rows.push("")
    rows.push("### Persistent Memory Bank (Memory over Time):")
    rows.push("Check `memo_query` on session start for architectural gotchas or past research. Use `memo_save` to persist critical findings.")

    return rows.join("\n")
}

export function buildExploreSection(agents: AvailableAgent[]): string {
    const exploreAgent = agents.find((a) => a.name === "explore")
    if (!exploreAgent) return ""

    const useWhen = exploreAgent.metadata.useWhen || []
    const avoidWhen = exploreAgent.metadata.avoidWhen || []

    return `### Explore Agent = Contextual Grep

Use it as a **peer tool**, not a fallback. Fire liberally.

**Use Direct Tools when:**
${avoidWhen.map((w) => `- ${w}`).join("\n")}

**Use Explore Agent when:**
${useWhen.map((w) => `- ${w}`).join("\n")}`
}

export function buildLibrarianSection(agents: AvailableAgent[]): string {
    const librarianAgent = agents.find((a) => a.name === "librarian")
    if (!librarianAgent) return ""

    const useWhen = librarianAgent.metadata.useWhen || []

    return `### Librarian Agent = Reference Grep

Search **external references** (docs, OSS, web). Fire proactively when unfamiliar libraries are involved.

**Contextual Grep (Internal)** — search OUR codebase, find patterns in THIS repo, project-specific logic.
**Reference Grep (External)** — search EXTERNAL resources, official API docs, library best practices, OSS implementation examples.

**Trigger phrases** (fire librarian immediately):
${useWhen.map((w) => `- "${w}"`).join("\n")}`
}

export function buildDelegationTable(agents: AvailableAgent[]): string {
    const rows: string[] = [
        "### Delegation Table:",
        "",
    ]

    for (const agent of agents) {
        for (const trigger of agent.metadata.triggers) {
            rows.push(`- **${trigger.domain}** → \`${agent.name}\` — ${trigger.trigger}`)
        }
    }

    return rows.join("\n")
}

export function buildCategorySkillsDelegationGuide(categories: AvailableCategory[], skills: AvailableSkill[]): string {
    if (categories.length === 0 && skills.length === 0) return ""

    const categoryRows = categories.map((c) => {
        const desc = c.description || c.name
        return `- \`${c.name}\` — ${desc}`
    })

    const builtinSkills = skills.filter((s) => s.location === "plugin")
    const customSkills = skills.filter((s) => s.location !== "plugin")

    const builtinNames = builtinSkills.map((s) => s.name).join(", ")
    const customNames = customSkills.map((s) => {
        const source = s.location === "project" ? "project" : "user"
        return `${s.name} (${source})`
    }).join(", ")

    let skillsSection: string

    if (customSkills.length > 0 && builtinSkills.length > 0) {
        skillsSection = `#### Available Skills (via \`skill\` tool)

**Built-in**: ${builtinNames}
**⚡ YOUR SKILLS (PRIORITY)**: ${customNames}

> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.
> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`
    } else if (customSkills.length > 0) {
        skillsSection = `#### Available Skills (via \`skill\` tool)

**⚡ YOUR SKILLS (PRIORITY)**: ${customNames}

> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.
> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`
    } else if (builtinSkills.length > 0) {
        skillsSection = `#### Available Skills (via \`skill\` tool)

**Built-in**: ${builtinNames}

> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`
    } else {
        skillsSection = ""
    }

    return `### Category + Skills Delegation System

**task() combines categories and skills for optimal task execution.**

#### Available Categories (Domain-Optimized Models)

Each category is configured with a model optimized for that domain. Read the description to understand when to use it.

${categoryRows.join("\n")}

${skillsSection}

---

### MANDATORY: Category + Skill Selection Protocol

**STEP 1: Select Category**
- Read each category's description
- Match task requirements to category domain
- Select the category whose domain BEST fits the task

**STEP 2: Evaluate ALL Skills**
Check the \`skill\` tool for available skills and their descriptions. For EVERY skill, ask:
> "Does this skill's expertise domain overlap with my task?"

- If YES → INCLUDE in \`load_skills=[...]\`
- If NO → OMIT (no justification needed)
${customSkills.length > 0 ? `
> **User-installed skills get PRIORITY.** When in doubt, INCLUDE rather than omit.` : ""}

---

### Delegation Pattern

\`\`\`typescript
task(
  category="[selected-category]",
  load_skills=["skill-1", "skill-2"],  // Include ALL relevant skills — ESPECIALLY user-installed ones
  prompt="..."
)
\`\`\`

**ANTI-PATTERN (will produce poor results):**
\`\`\`typescript
task(category="...", load_skills=[], run_in_background=false, prompt="...")  // Empty load_skills without justification
\`\`\`

---

### Category Domain Matching (ZERO TOLERANCE)

Every delegation MUST use the category that matches the task's domain. Mismatched categories produce measurably worse output because each category runs on a model optimized for that specific domain.

**VISUAL WORK = ALWAYS \`visual-engineering\`. NO EXCEPTIONS.**

Any task involving UI, UX, CSS, styling, layout, animation, design, or frontend components MUST go to \`visual-engineering\`. Never delegate visual work to \`quick\`, \`unspecified-*\`, or any other category.

\`\`\`typescript
// CORRECT: Visual work → visual-engineering category
task(category="visual-engineering", load_skills=["frontend-ui-ux"], prompt="Redesign the sidebar layout with new spacing...")

// WRONG: Visual work in wrong category — WILL PRODUCE INFERIOR RESULTS
task(category="quick", load_skills=[], prompt="Redesign the sidebar layout with new spacing...")
\`\`\`

| Task Domain | MUST Use Category |
|---|---|
| UI, styling, animations, layout, design | \`visual-engineering\` |
| Hard logic, architecture decisions, algorithms | \`ultrabrain\` |
| Autonomous research + end-to-end implementation | \`deep\` |
| Single-file typo, trivial config change | \`quick\` |

**When in doubt about category, it is almost never \`quick\` or \`unspecified-*\`. Match the domain.**`
}

export function buildOracleSection(agents: AvailableAgent[]): string {
    const oracleAgent = agents.find((a) => a.name === "oracle")
    if (!oracleAgent) return ""

    const useWhen = oracleAgent.metadata.useWhen || []
    const avoidWhen = oracleAgent.metadata.avoidWhen || []

    return `<Oracle_Usage>
## Oracle — Read-Only High-IQ Consultant

Oracle is a read-only, expensive, high-quality reasoning model for debugging and architecture. Consultation only.

### WHEN to Consult (Oracle FIRST, then implement):

${useWhen.map((w) => `- ${w}`).join("\n")}

### WHEN NOT to Consult:

${avoidWhen.map((w) => `- ${w}`).join("\n")}

### Usage Pattern:
Briefly announce "Consulting Oracle for [reason]" before invocation.

**Exception**: This is the ONLY case where you announce before acting. For all other work, start immediately without status updates.

### Oracle Background Task Policy:

**Collect Oracle results before your final answer. No exceptions.**

- Oracle takes minutes. When done with your own work: **end your response** — wait for the \`<system-reminder>\`.
- Do NOT poll \`background_output\` on a running Oracle. The notification will come.
- Never cancel Oracle.
</Oracle_Usage>`
}

export function buildNonClaudePlannerSection(model?: string): string {
    const isNonClaude = model ? !model.toLowerCase().includes('claude') : true
    if (!isNonClaude) return ""

    return `### Plan Agent Dependency (Non-Claude)

Multi-step task? **ALWAYS consult Plan Agent first.** Do NOT start implementation without a plan.

- Single-file fix or trivial change → proceed directly
- Anything else (2+ steps, unclear scope, architecture) → \`task(subagent_type="plan", ...)\` FIRST
- Use \`session_id\` to resume the same Plan Agent — ask follow-up questions aggressively
- If ANY part of the task is ambiguous, ask Plan Agent before guessing

Plan Agent returns a structured work breakdown with parallel execution opportunities. Follow it.`
}

export function buildDeepParallelSection(model: string, categories: AvailableCategory[]): string {
    const isClaude = model.toLowerCase().includes('claude')
    const hasDeepCategory = categories.some(c => c.name === 'deep')

    if (!hasDeepCategory) return ""

    return `### Speculative Parallel Research (Performance Hardening)
${isClaude ? "\nAnthropic Prompt Caching is active. Parallel searches are extremely cheap and fast." : ""}

Delegate EVERY independent research or implementation unit to a \`deep\` agent in parallel (\`run_in_background=true\`).
Do NOT wait for one task to finish before starting the next if they are independent.
If a task decomposes into multiple independent units, spawn agents simultaneously — not 1 at a time.

1. Decompose the goal into independent work units (e.g. searching 3 different modules)
2. Spawn \`deep\` agents simultaneously for each unit via \`run_in_background=true\`
3. Provide each agent with clear objectives/GOALS and success criteria
4. Integrate results once background notifications arrive or collect all results to verify coherence`
}

export function buildUltraworkSection(
    agents: AvailableAgent[],
    categories: AvailableCategory[],
    skills: AvailableSkill[]
): string {
    const lines: string[] = []

    if (categories.length > 0) {
        lines.push("**Categories** (for implementation tasks):")
        for (const cat of categories) {
            const shortDesc = cat.description || cat.name
            lines.push(`- \`${cat.name}\`: ${shortDesc}`)
        }
        lines.push("")
    }

    if (skills.length > 0) {
        const builtinSkills = skills.filter((s) => s.location === "plugin")
        const customSkills = skills.filter((s) => s.location !== "plugin")

        if (builtinSkills.length > 0) {
            lines.push("**Built-in Skills** (combine with categories):")
            for (const skill of builtinSkills) {
                const shortDesc = skill.description.split(".")[0] || skill.description
                lines.push(`- \`${skill.name}\`: ${shortDesc}`)
            }
            lines.push("")
        }

        if (customSkills.length > 0) {
            lines.push("**User-Installed Skills** (HIGH PRIORITY - user installed these for their workflow):")
            for (const skill of customSkills) {
                const shortDesc = skill.description.split(".")[0] || skill.description
                lines.push(`- \`${skill.name}\`: ${shortDesc}`)
            }
            lines.push("")
        }
    }

    if (agents.length > 0) {
        const ultraworkAgentPriority = ["explore", "librarian", "plan", "oracle"]
        const sortedAgents = [...agents].sort((a, b) => {
            const aIdx = ultraworkAgentPriority.indexOf(a.name)
            const bIdx = ultraworkAgentPriority.indexOf(b.name)
            if (aIdx === -1 && bIdx === -1) return 0
            if (aIdx === -1) return 1
            if (bIdx === -1) return -1
            return aIdx - bIdx
        })

        lines.push("**Agents** (for specialized consultation/exploration):")
        for (const agent of sortedAgents) {
            const shortDesc = agent.description.length > 120 ? agent.description.slice(0, 120) + "..." : agent.description
            const suffix = agent.name === "explore" || agent.name === "librarian" ? " (multiple)" : ""
            lines.push(`- \`${agent.name}${suffix}\`: ${shortDesc}`)
        }
    }

    return lines.join("\n")
}
