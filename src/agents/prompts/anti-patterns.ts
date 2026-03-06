export const ANTI_PATTERNS_PROMPT = `## Anti-Patterns (BLOCKING violations)

- **Type Safety**: \`as any\`, \`@ts-ignore\`, \`@ts-expect-error\`
- **Error Handling**: Empty catch blocks \`catch(e) {}\`
- **Testing**: Deleting failing tests to "pass"
- **Search**: Firing agents for single-line typos or obvious syntax errors
- **Debugging**: Shotgun debugging, random changes
- **Background Tasks**: Polling \`background_output\` on running tasks — end response and wait for notification
- **Oracle**: Delivering answer without collecting Oracle results
- **Fabrication**: Claiming push/PR/build succeeded without tool output evidence
- **Simulation**: Reasoning about system state without running verification commands`;

export function buildAntiPatternsSection(): string {
    return ANTI_PATTERNS_PROMPT;
}
