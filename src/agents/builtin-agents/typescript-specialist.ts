import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "../types"
import { createAgentToolRestrictions } from "../../shared/permission-compat"
import { typescriptPack } from "../../features/language-intelligence/packs/typescript"

const MODE: AgentMode = "subagent"

export const TYPESCRIPT_SPECIALIST_PROMPT_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "TypeScript Specialist",
  keyTrigger: "Complex TypeScript type errors, structural refactoring, or bundler issues → fire `typescript-specialist`",
  triggers: [
    { domain: "TypeScript/Frontend", trigger: "Deep TS refactoring, tricky generic type errors, Vite/Next.js build failures, ESM/CJS resolution issues" },
  ],
  useWhen: [
    "Refactor this TypeScript interface/module",
    "Fix this complex TS type error",
    "Resolve this Vite/Next.js build issue",
    "Migrate this codebase to strict mode",
  ],
}

export function createTypeScriptSpecialistAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([])

  const rulesContext = typescriptPack.rules.map(r => `- ${r}`).join("\n")
  const workflowContext = `
## WORKFLOWS
- Build: ${typescriptPack.buildFlow}
- Test: ${typescriptPack.testFlow}
- Lint: ${typescriptPack.lintFlow}
  `
  
  const repairsContext = Object.entries(typescriptPack.repairSteps).map(([cat, rules]) => {
    return `### ${cat.toUpperCase()}\n` + rules.map((r: string) => `- ${r}`).join("\n")
  }).join("\n\n")

  return {
    description:
      "Specialized TypeScript expert agent. Used exclusively for complex TypeScript tasks: deep structural refactoring, fixing tricky generic/type errors, resolving ESM/CJS or bundler issues, and migrating codebases. Pre-loaded with deep knowledge of TS idioms, type gymnastics, and ecosystem tools.",
    mode: MODE,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt: `# TYPESCRIPT SPECIALIST

You are the **TYPESCRIPT SPECIALIST**, an expert-level subagent dedicated to solving complex TypeScript problems.
You possess deep knowledge of TS idioms, strict typing, generic gymnastics, and modern bundlers/frameworks (Vite, Next.js, Node ESM).

## LANGUAGE RULES & IDIOMS
${rulesContext}

${workflowContext}

## COMMON FAILURE REPAIRS
${repairsContext}

## YOUR DIRECTIVE
1. You are called when the main agent struggles with a TypeScript-specific issue.
2. Analyze the problem deeply. If it's a type error or build failure, look at the exact compiler output and use the COMMON FAILURE REPAIRS guide above.
3. If it's a refactoring task, ensure you adhere to the LANGUAGE RULES & IDIOMS (e.g., favoring absolute imports, strict typing).
4. Always leverage the appropriate package manager (pnpm/bun/npm) and build/test workflows for verification.
5. Communicate your findings and the exact fix clearly using code snippets.
`,
  }
}
createTypeScriptSpecialistAgent.mode = MODE
