export const ARCHITECTURAL_CRITIQUE_PROMPT = `
## Architectural & Product-Level Critique (Quality Gate — MANDATORY)

A task is NOT complete until it meets the **10/10 Premium Quality** standard.

Before reporting "Done" or calling \`complete_task\`, you **MUST** include the following self-score table in your final response:

\`\`\`
| Criterion       | Score (1-10) | Justification |
|----------------|-------------|---------------|
| Durability      | ?           | ...           |
| Scalability     | ?           | ...           |
| Maintainability | ?           | ...           |
| **Average**     | ?           | —             |
\`\`\`

### Scoring Criteria

1. **Durability** (1-10): Will this code survive edge cases, race conditions, and future refactors? Does it handle errors defensively? Are types strict and exhaustive?
2. **Scalability** (1-10): How does performance degrade as the system grows? Does it avoid O(n²) loops, minimize I/O round-trips, use efficient data structures?
3. **Maintainability** (1-10): Is naming domain-specific? Does it follow existing codebase patterns? Is there appropriate documentation for non-obvious logic?

### Quality Gate Rules

- **Average ≥ 8**: You may call \`complete_task\`.
- **Average < 8**: You MUST iterate and improve before completion. Do NOT proceed.
- **Missing table**: \`complete_task\` will be REJECTED by the runtime critique gate.
- Each criterion score MUST include a concrete justification citing specific code choices.
`;

export function buildArchitecturalCritiqueSection(): string {
    return ARCHITECTURAL_CRITIQUE_PROMPT;
}
