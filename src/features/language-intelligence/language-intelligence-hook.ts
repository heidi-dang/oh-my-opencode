import { log } from "../../shared/logger"
import { ContextCollector } from "../context-injector/collector"
import { detectLanguage } from "./language-detector"
import { routeLanguage, formatLanguageContext, formatFailureContext } from "./language-router"
import { RepoExampleExtractor } from "./repo-example-extractor"
import { LanguageMemory } from "./language-memory"
import type { LanguagePack, LanguageProfile } from "./types"

interface LanguageIntelligenceHookArgs {
  collector: ContextCollector
  directory: string
}

export function createLanguageIntelligenceHook(args: LanguageIntelligenceHookArgs) {
  const { collector, directory } = args
  const detectedProfiles = new Map<string, LanguageProfile>()
  const activePacks = new Map<string, LanguagePack>()

  return {
    "chat.message": async (
      input: { sessionID: string; agent?: string },
      output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> }
    ) => {
      // Re-scan if profile not set or if session might benefit from refresh
      // We check sessionID to avoid double injection in the same session turn
      try {
        let profile = detectedProfiles.get(input.sessionID)
        if (!profile) {
          profile = await detectLanguage(directory)
          if (profile.primary === "unknown") return
          detectedProfiles.set(input.sessionID, profile)
        }

        // Extract user message text for stepbook matching
        const userMessage = output.parts
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text)
          .join("\n")

        const route = routeLanguage(profile, userMessage)
        if (!route) return

        activePacks.set(input.sessionID, route.pack)

        const extractor = new RepoExampleExtractor(directory)
        const [examples] = await Promise.all([
           extractor.extractIfNeeded()
        ])
        const examplesContext = extractor.formatForInjection()

        const memory = new LanguageMemory()
        const memoryContext = memory.formatForInjection(profile.primary)

        let languageContext = formatLanguageContext(route, profile)
        if (examplesContext) {
          languageContext += `\n\n${examplesContext}`
        }
        if (memoryContext) {
          languageContext += `\n\n${memoryContext}`
        }

        // We use a stable ID to ensure we overwrite previous detections in the same session if they change
        collector.register(input.sessionID, {
          id: "language-intelligence",
          source: "custom",
          content: languageContext,
          priority: "high",
          persistent: true,
          metadata: {
            type: "language-intelligence",
            language: profile.primary,
            taskClass: route.taskClass,
            stepbook: route.stepbook?.id,
          },
        })

        log("[Heidi Language Intelligence] Injected language context", {
          sessionID: input.sessionID,
          language: profile.primary,
          confidence: profile.confidence,
          stepbook: route.stepbook?.id ?? "none",
        })
      } catch (error) {
        log("[Heidi Language Intelligence] Detection/Injection failed", {
          error: String(error),
        })
      }
    },

    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: unknown }
    ) => {
      const pack = activePacks.get(input.sessionID)
      if (!pack) return

      // Only scan command-execution tools for failure signatures
      const commandTools = ["bash", "terminal", "execute_command", "shell", "git"]
      const toolName = input.tool.toLowerCase()
      if (!commandTools.some((t) => toolName.includes(t))) return

      try {
        const failureContext = formatFailureContext(pack, output.output)
        if (failureContext) {
          collector.register(input.sessionID, {
            id: `failure-diagnosis-${input.callID}`, // unique per call to allow multiple diagnoses
            source: "custom",
            content: failureContext,
            priority: "critical",
            persistent: false,
            metadata: { type: "failure-diagnosis", tool: input.tool },
          })

          log("[Heidi Language Intelligence] Failure signature matched", {
            sessionID: input.sessionID,
            tool: input.tool,
            language: pack.language,
          })
        }
      } catch (error) {
        log("[Heidi Language Intelligence] Diagnosis failed", { error: String(error) })
      }
    },
  }
}
