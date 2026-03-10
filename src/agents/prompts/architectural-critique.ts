export const ARCHITECTURAL_CRITIQUE_PROMPT = `
## Architectural & Product-Level Critique (Quality Hardening)

A task is NOT complete until it meets the **Premium Quality** standard. Before reporting "Done" or calling 'complete_task', you MUST perform a self-critique of your implementation and justify it based on:

1. **Durability**: Why will this code NOT break easily under edge cases or future changes? (e.g., proper error handling, robust type definitions, defensive checks).
2. **Scalability**: How will this solution perform as the system grows? (e.g., avoids $O(n^2)$ complexity, minimizes I/O, uses efficient data structures).
3. **Maintainability**: Is this code readable and standard? (e.g., follows domain naming, matches codebase patterns, has appropriate comments).

**AUTHORITATIVE QUALITY GATE**:
If your work feels "just functional" or "MVP-level", you have FAILED the 9.5/10 quality target. Iterate until it feels premium. Summarize your justification in your final response or internal thought block.
`;

export function buildArchitecturalCritiqueSection(): string {
    return ARCHITECTURAL_CRITIQUE_PROMPT;
}
