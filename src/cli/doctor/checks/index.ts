import type { CheckDefinition } from "../types"
import { CHECK_IDS, CHECK_NAMES } from "../constants"
import { checkSystem, gatherSystemInfo } from "./system"
import { checkConfig } from "./config"
import { checkTools, gatherToolsSummary } from "./tools"
import { checkModels } from "./model-resolution"
import { checkFork } from "./fork"
import { checkPlanCompiler } from "./plan-compiler"
import { checkDefaultConfig } from "./default-config"
import { checkProgress } from "./progress"
import { checkToolContract } from "./tool-contract"

export type { CheckDefinition }
export * from "./model-resolution-types"
export { gatherSystemInfo, gatherToolsSummary }

export function getAllCheckDefinitions(): CheckDefinition[] {
  return [
    {
      id: CHECK_IDS.SYSTEM,
      name: CHECK_NAMES[CHECK_IDS.SYSTEM],
      check: checkSystem,
      critical: true,
    },
    {
      id: CHECK_IDS.CONFIG,
      name: CHECK_NAMES[CHECK_IDS.CONFIG],
      check: checkConfig,
    },
    {
      id: CHECK_IDS.TOOLS,
      name: CHECK_NAMES[CHECK_IDS.TOOLS],
      check: checkTools,
    },
    {
      id: CHECK_IDS.MODELS,
      name: CHECK_NAMES[CHECK_IDS.MODELS],
      check: checkModels,
    },
    {
      id: CHECK_IDS.FORK,
      name: CHECK_NAMES[CHECK_IDS.FORK],
      check: checkFork,
    },
    {
      id: CHECK_IDS.DEFAULT_CONFIG,
      name: CHECK_NAMES[CHECK_IDS.DEFAULT_CONFIG],
      check: checkDefaultConfig,
    },
    {
      id: CHECK_IDS.PLAN_COMPILER,
      name: CHECK_NAMES[CHECK_IDS.PLAN_COMPILER],
      check: checkPlanCompiler,
    },
    {
      id: CHECK_IDS.PROGRESS,
      name: CHECK_NAMES[CHECK_IDS.PROGRESS],
      check: checkProgress,
    },
    {
      id: "TOOL_CONTRACT",
      name: "Tool Contract Compliance",
      check: checkToolContract,
    },
  ]
}
