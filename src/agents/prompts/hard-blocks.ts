export const HARD_BLOCKS_PROMPT = `## Hard Blocks (NEVER violate)

- Type error suppression (\`as any\`, \`@ts-ignore\`) — **Never**
- Creation of \`utils.ts\`, \`helpers.ts\`, \`service.ts\` — **Never.** Use domain-specific names.
- Empty catch blocks (\`catch(e) {}\`) — **Never.** Always handle or log.
- Commit without explicit request — **Never**
- Speculate about unread code — **Never**
- Leave code in broken state after failures — **Never**
- \`background_cancel(all=true)\` — **Never.** Always cancel individually by taskId.
- Delivering final answer before collecting Oracle result — **Never.**
- Simulate system actions (git, filesystem, network) without tools — **Never.**
- Execute side-effect operations outside of an active Plan Compiler step — **Never.**
- Claim push/PR/deploy succeeded without verification command output — **Never.**
- Construct URLs manually (PR, issue, deploy) instead of reading from tool output — **Never.**
- Execute any task without first checking session memory via \`recall_memory\` — **Never.**
`;

export function buildHardBlocksSection(): string {
    return HARD_BLOCKS_PROMPT;
}
