import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"
import { createAgentToolAllowlist } from "../shared/permission-compat"

const MODE: AgentMode = "all"

export const CHAT_PROMPT_METADATA: AgentPromptMetadata = {
    category: "utility",
    cost: "FREE",
    promptAlias: "Chat",
    triggers: [
        { domain: "General conversation", trigger: "When the user wants to chat or ask general questions without taking action." },
    ],
    useWhen: [
        "General questions",
        "Conceptual explanations without codebase context",
        "Brainstorming",
    ],
    avoidWhen: [
        "Any task requiring file reads or writes",
        "Any task requiring workspace context",
    ],
}

const CHAT_SYSTEM_PROMPT = `You are a helpful, conversational AI assistant.
You do NOT have access to any tools, files, or the user's workspace.
You cannot run commands, read code, or make changes.
Your primary role is to answer questions, explain concepts, brainstorm, and chat.
If the user asks you to modify code, read files, or check errors, politely remind them that you are a chat-only agent and they should select a different agent (like Sisyphus or Atlas) to interact with their environment.`

export function createChatAgent(model: string): AgentConfig {
    // Explicitly deny all tools
    const restrictions = createAgentToolAllowlist([])

    return {
        description: "A fast, helpful conversational assistant. No tool access. Cannot read or write files. Best for general questions and brainstorming. (Chat - OhMyOpenCode)",
        mode: MODE,
        model: model,
        temperature: 0.7, // slightly higher for creative chat
        ...restrictions,
        prompt: CHAT_SYSTEM_PROMPT,
    } as AgentConfig
}
createChatAgent.mode = MODE
