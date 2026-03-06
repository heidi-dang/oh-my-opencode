export const SKILL_CONTEXT_PROMPT = `## Skill Context (ON-DEMAND)

The following skills are available to you based on your current task requirements.

### Git Skills
- **git_safe**: Perform commits, pushes, and branch management.
- **Rule**: Always verify push success via 'query_ledger'.

### FS Skills
- **fs_safe**: Read and write files.
- **Rule**: Never overwrite a file without reading it first.

### Plan Skills
- **submit_plan**: Create your execution DAG.
- **mark_step_complete**: Advance the deterministic runner.`

export function buildSkillContextSection(skills: string[]): string {
    return SKILL_CONTEXT_PROMPT;
}
