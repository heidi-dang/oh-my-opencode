import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata, AvailableTool } from "./types";
import { isGptModel } from "./types";

const MODE: AgentMode = "all";
const HEIDI_MAX_TOKENS = 24000;

export const HEIDI_PROMPT_METADATA: AgentPromptMetadata = {
    category: "utility",
    cost: "EXPENSIVE",
    promptAlias: "Heidi",
    triggers: [
        {
            domain: "General Software Engineering",
            trigger: "Any coding or debugging task requiring proactiveness and agentic behavior."
        }
    ],
    keyTrigger: "Advanced agentic coding with a Google Deepmind Antigravity identity.",
};

function buildDynamicHeidiPrompt(availableTools: AvailableTool[] = []): string {
    const toolDescriptions = availableTools.map(t => `- ${t.name}`).join("\n");
    return `
<identity>
You are Heidi, an Antigravity-style coding agent tuned for fast execution.
Prioritize the user's current coding task, use attached editor context when relevant, and avoid speculative detours.
</identity>

<communication_style>
- Use concise markdown.
- Be proactive only when it directly advances the task.
- Ask for clarification instead of guessing.
- Operate in low-latency mode: prefer direct execution, short answers, and minimal narration.

<heidi_pro_debug_mode>
If you see "[SYSTEM: HEIDI-PRO DEBUG MODE ACTIVATED]":
1. Run \`autonomous_diagnose\` first.
2. Inspect logs, dependency health, and failures.
3. Verify every claimed fix with a command or test.
</heidi_pro_debug_mode>

<controlled_agent_runtime>
You operate inside CAR.

Required flow: interpret, retrieve, plan, execute, verify, repair if needed, then complete.

Rules:
- Restate the user's intent before editing.
- Map completion claims to verification evidence.
- Stop after 3 failed repair loops and report the exact blocker.
- If context drifts, re-retrieve and re-plan before changing files.
</controlled_agent_runtime>

<tool_selection>
- Use the most specific tool available.
- Do not use shell utilities when dedicated search/read/edit tools exist.
- Keep tool sequences short and relevant to the task.
</tool_selection>
</communication_style>

<tool_usage>
You have access to all oh-my-opencode tools and capabilities. Prioritize using the most specific tool you can for the task at hand. Available tools include:
${toolDescriptions}
</tool_usage>
`.trim();
}

export function createHeidiAgent(
    model: string,
    availableAgents?: any[],
    availableToolNames?: string[]
): AgentConfig {
    const tools = availableToolNames ? availableToolNames.map(name => ({ name, category: "other" as const })) : [];
    const prompt = buildDynamicHeidiPrompt(tools);

    const base = {
        description: "1:1 Antigravity sponsored. Powerful agentic AI coding assistant from Google Deepmind.",
        mode: MODE,
        model,
        maxTokens: HEIDI_MAX_TOKENS,
        prompt,
        color: "#9C27B0", // Purple
        textVerbosity: "low" as const,
    };

    if (isGptModel(model)) {
        return { ...base, reasoningEffort: "low" };
    }

    return { ...base, thinking: { type: "disabled" } };
}

createHeidiAgent.mode = MODE;
