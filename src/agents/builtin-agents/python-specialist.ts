import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "../types"
import { createAgentToolRestrictions } from "../../shared/permission-compat"
import { pythonPack } from "../../features/language-intelligence/packs/python"

const MODE: AgentMode = "subagent"

export const PYTHON_SPECIALIST_PROMPT_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Python Specialist",
  keyTrigger: "Complex Python architectural redesign, pytest debugging, or dependency resolution → fire `python-specialist`",
  triggers: [
    { domain: "Python/Backend", trigger: "Deep Python refactoring, tricky pytest failures, asyncio/multiprocessing complexity, UV/Poetry/Pipenv package resolution issues" },
  ],
  useWhen: [
    "Refactor this Python module",
    "Fix these failing pytests",
    "Resolve this Python import circular dependency",
    "Optimize this Python code",
  ],
}

export function createPythonSpecialistAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([])

  const rulesContext = pythonPack.rules.map(r => `- ${r}`).join("\n")
  const workflowContext = `
## WORKFLOWS
- Build: ${pythonPack.buildFlow}
- Test: ${pythonPack.testFlow}
- Lint: ${pythonPack.lintFlow}
  `
  
  const repairsContext = Object.entries(pythonPack.repairSteps).map(([cat, rules]) => {
    return `### ${cat.toUpperCase()}\n` + rules.map((r: string) => `- ${r}`).join("\n")
  }).join("\n\n")

  return {
    description:
      "Specialized Python expert agent. Used exclusively for complex Python tasks: deep refactoring, fixing tricky pytest failures, resolving dependency/import issues, and optimizing async/performance bottlenecks. Pre-loaded with deep knowledge of Python idioms, packaging, and common failure modes.",
    mode: MODE,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt: `# PYTHON SPECIALIST

You are the **PYTHON SPECIALIST**, an expert-level subagent dedicated to solving complex Python problems.
You possess deep knowledge of Python idioms, AST, packaging (uv, poetry, pip), and testing frameworks (pytest).

## LANGUAGE RULES & IDIOMS
${rulesContext}

${workflowContext}

## COMMON FAILURE REPAIRS
${repairsContext}

## YOUR DIRECTIVE
1. You are called when the main agent struggles with a Python-specific issue.
2. Analyze the problem deeply. If it's a test failure, look at the exact traceback and use the COMMON FAILURE REPAIRS guide above.
3. If it's a refactoring task, ensure you adhere to the LANGUAGE RULES & IDIOMS.
4. Always leverage the appropriate build/test workflows for verification.
5. Communicate your findings and the exact fix clearly using code snippets.
`,
  }
}
createPythonSpecialistAgent.mode = MODE
