import type { AgentConfig } from "@opencode-ai/sdk";
import type {
    AgentMode,
    AgentPromptMetadata,
    AvailableAgent,
    AvailableTool,
    AvailableSkill,
    AvailableCategory,
} from "./types";
import { isGptModel } from "./types";
import {
    buildAgentPromptInvariantSection,
    buildHeidiAgentCapabilityMatrixSection,
} from "./capability-matrix";
import {
    buildCategorySkillsDelegationGuide,
    buildDelegationTable,
    buildKeyTriggersSection,
    categorizeTools,
} from "./prompts";

const MODE: AgentMode = "all";
const HEIDI_MAX_TOKENS = 64000;

export interface HeidiContext {
    model?: string;
    availableAgents?: AvailableAgent[];
    availableTools?: AvailableTool[];
    availableSkills?: AvailableSkill[];
    availableCategories?: AvailableCategory[];
    useTaskSystem?: boolean;
}

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

function buildHeidiAvailableAgentsSection(availableAgents: AvailableAgent[]): string {
    const agents = availableAgents.filter((agent) => agent.name !== "heidi");

    if (agents.length === 0) {
        return "";
    }

    const lines = agents.map((agent) => {
        const alias = agent.metadata.promptAlias ?? agent.name;
        return `- \`${agent.name}\` (${alias}) — ${agent.description}`;
    });

    return `## Available Specialists\n${lines.join("\n")}`;
}

function buildDynamicHeidiPrompt(ctx?: HeidiContext): string {
    const availableAgents = ctx?.availableAgents ?? [];
    const availableTools = ctx?.availableTools ?? [];
    const availableSkills = ctx?.availableSkills ?? [];
    const availableCategories = ctx?.availableCategories ?? [];
    const toolDescriptions = availableTools.map(t => `- ${t.name}`).join("\n");
    const keyTriggers = buildKeyTriggersSection(availableAgents, availableSkills);
    const delegationTable = buildDelegationTable(availableAgents);
    const categorySkillsGuide = buildCategorySkillsDelegationGuide(availableCategories, availableSkills);
    const availableAgentsSection = buildHeidiAvailableAgentsSection(availableAgents);

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
- Use the active dropdown-selected model for your own execution when provided. Do not invent a separate Heidi-only model lane unless the user explicitly overrides it.
</controlled_agent_runtime>

<tool_selection>
- Use the most specific tool available.
- Do not use shell utilities when dedicated search/read/edit tools exist.
- Keep tool sequences short and relevant to the task.
- Frontend, UI, CSS, layout, animation, responsive, accessibility, and visual polish work should be delegated to \`ui-ux-specialist\` via \`task(subagent_type="ui-ux-specialist", load_skills=[], ...)\`.
- After any specialist delegation, verify the result yourself before wrapping up.
</tool_selection>
</communication_style>

<specialist_routing>
- Use \`ui-ux-specialist\` for user-facing redesigns, design-system-sensitive component work, responsive fixes, interaction polish, and visual QA.
- When the app can run, ask that specialist to verify with browser automation or screenshots before it reports completion.
- Use direct implementation only for trivial frontend copy or one-line style fixes that do not need design judgment.
</specialist_routing>

${availableAgentsSection}

${keyTriggers}

${delegationTable}

${categorySkillsGuide}

${buildHeidiAgentCapabilityMatrixSection(["hephaestus"])}

${buildAgentPromptInvariantSection("hephaestus")}

<tool_usage>
You have access to all oh-my-opencode tools and capabilities. Prioritize using the most specific tool you can for the task at hand. Available tools include:
${toolDescriptions}
</tool_usage>
`.trim();
}

export function createHeidiAgent(
    model: string,
    availableAgents?: AvailableAgent[],
    availableToolNames?: string[],
    availableSkills?: AvailableSkill[],
    availableCategories?: AvailableCategory[],
    useTaskSystem = false,
): AgentConfig {
    const tools = availableToolNames ? categorizeTools(availableToolNames) : [];
    const prompt = buildDynamicHeidiPrompt({
        model,
        availableAgents,
        availableTools: tools,
        availableSkills,
        availableCategories,
        useTaskSystem,
    });

    const base = {
        description: "1:1 Antigravity sponsored. Powerful agentic AI coding assistant from Google Deepmind.",
        mode: MODE,
        model,
        maxTokens: HEIDI_MAX_TOKENS,
        prompt,
        color: "#9C27B0", // Purple
    };

    if (isGptModel(model)) {
        return { ...base, reasoningEffort: "high" };
    }

    return { ...base, thinking: { type: "enabled", budgetTokens: 16000 } };
}

createHeidiAgent.mode = MODE;
