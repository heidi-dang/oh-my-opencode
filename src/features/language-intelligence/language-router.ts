import { log } from "../../shared/logger"
import type { LanguageProfile, LanguagePack, Stepbook, LanguageRouteResult } from "./types"
import { pythonPack } from "./packs/python"
import { typescriptPack } from "./packs/typescript"
import { pythonStepbooks } from "./stepbooks/python-stepbooks"
import { typescriptStepbooks } from "./stepbooks/typescript-stepbooks"

const packRegistry = new Map<string, LanguagePack>([
  ["python", pythonPack],
  ["typescript", typescriptPack],
])

const stepbookRegistry = new Map<string, Stepbook[]>([
  ["python", pythonStepbooks],
  ["typescript", typescriptStepbooks],
])

function findMatchingStepbook(language: string, userMessage: string): Stepbook | null {
  const stepbooks = stepbookRegistry.get(language)
  if (!stepbooks) return null

  const messageLower = userMessage.toLowerCase()

  let bestMatch: Stepbook | null = null
  let bestScore = 0

  for (const stepbook of stepbooks) {
    let triggerScore = 0
    for (const trigger of stepbook.triggers) {
      if (messageLower.includes(trigger.toLowerCase())) {
        triggerScore += trigger.length
      }
    }

    if (triggerScore > bestScore) {
      bestScore = triggerScore
      bestMatch = stepbook
    }
  }

  if (bestMatch) {
    log("[Heidi Language Router] Matched stepbook", {
      language,
      stepbook: bestMatch.id,
      taskClass: bestMatch.taskClass,
    })
  }

  return bestMatch
}

export function routeLanguage(profile: LanguageProfile, userMessage: string): LanguageRouteResult | null {
  const pack = packRegistry.get(profile.primary)
  if (!pack) {
    log("[Heidi Language Router] No pack found for language", { language: profile.primary })
    return null
  }

  const stepbook = findMatchingStepbook(profile.primary, userMessage)

  return {
    pack,
    stepbook,
    taskClass: stepbook?.taskClass ?? null,
  }
}

export function formatLanguageContext(route: LanguageRouteResult, profile: LanguageProfile): string {
  const { pack, stepbook } = route
  const sections: string[] = []

  sections.push(`[HEIDI LANGUAGE INTELLIGENCE — ${pack.displayName} Mode]`)
  sections.push("")

  // Detection metadata
  const meta: string[] = [`Language: ${pack.displayName}`]
  if (profile.buildTool) meta.push(`Build tool: ${profile.buildTool}`)
  if (profile.testTool) meta.push(`Test tool: ${profile.testTool}`)
  if (profile.lintTool) meta.push(`Lint tool: ${profile.lintTool}`)
  if (profile.secondary.length > 0) meta.push(`Also detected: ${profile.secondary.join(", ")}`)
  sections.push(meta.join(" | "))
  sections.push("")

  // Rules
  sections.push("## Language Rules")
  for (const rule of pack.rules) {
    sections.push(`- ${rule}`)
  }
  sections.push("")

  // Flows
  sections.push("## Workflows")
  sections.push(pack.buildFlow)
  sections.push("")
  sections.push(pack.testFlow)
  sections.push("")
  sections.push(pack.lintFlow)
  sections.push("")

  // Import patterns
  sections.push("## Import Patterns")
  sections.push(pack.importPatterns)
  sections.push("")

  // Stepbook if matched
  if (stepbook) {
    sections.push(`## Active Stepbook: ${stepbook.description}`)
    sections.push(`Follow this step ladder for the current task:`)
    for (const step of stepbook.steps) {
      let stepLine = `${step.order}. ${step.action}`
      if (step.command) stepLine += ` → \`${step.command}\``
      if (step.validate) stepLine += ` ✓ ${step.validate}`
      if (step.fallback) stepLine += ` (fallback: ${step.fallback})`
      sections.push(stepLine)
    }
    sections.push("")
  }

  return sections.join("\n")
}

export function formatFailureContext(pack: LanguagePack, errorOutput: string): string | null {
  const matchedSignatures = pack.failureSignatures.filter((sig) =>
    errorOutput.includes(sig.pattern)
  )

  if (matchedSignatures.length === 0) return null

  const sections: string[] = [
    `[HEIDI FAILURE DIAGNOSIS — ${pack.displayName}]`,
    "",
  ]

  for (const sig of matchedSignatures) {
    sections.push(`### ${sig.diagnosis}`)
    sections.push(`Pattern matched: \`${sig.pattern}\``)
    sections.push("Repair steps:")
    for (const fix of sig.fix) {
      sections.push(`- ${fix}`)
    }

    // Add detailed repair steps if available
    for (const [errorType, steps] of Object.entries(pack.repairSteps)) {
      if (sig.pattern.toLowerCase().includes(errorType.toLowerCase())) {
        sections.push("Detailed procedure:")
        for (const step of steps) {
          sections.push(`  ${step}`)
        }
      }
    }
    sections.push("")
  }

  return sections.join("\n")
}
