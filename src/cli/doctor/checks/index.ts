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
import { checkEditAtomicity } from "./edit-atomicity"
import { checkIssueResolutionWorkflow } from "./issue-resolution"
import { checkToolMetadataContract } from "./tool-metadata"
import { checkRunStateWatchdog } from "./run-state-watchdog"

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
      id: CHECK_IDS.EDIT_ATOMICITY,
      name: CHECK_NAMES[CHECK_IDS.EDIT_ATOMICITY],
      check: checkEditAtomicity.check,
    },
    {
      id: "issue-resolution",
      name: "Issue Resolution Workflow",
      check: checkIssueResolutionWorkflow,
    },
    {
      id: checkToolMetadataContract.id,
      name: checkToolMetadataContract.name,
      check: checkToolMetadataContract.check,
    },
    {
      id: checkRunStateWatchdog.id,
      name: checkRunStateWatchdog.name,
      check: checkRunStateWatchdog.check,
    },
  ]
}

