import { log } from "../../shared/logger"
import { ContextCollector } from "../context-injector/collector"
import { detectLanguage } from "./language-detector"
import { routeLanguage, formatLanguageContext, formatFailureContext } from "./language-router"
import { RepoExampleExtractor } from "./repo-example-extractor"
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
      input: { sessionID: string; parts: Array<{ type: string; text?: string }> },
      output: { parts: Array<{ type: string; text: string }> }
    ) => {
      // Only detect on first message (if profile not already cached for this session)
      if (detectedProfiles.has(input.sessionID)) return

      try {
        const profile = await detectLanguage(directory)
        if (profile.primary === "unknown") return

        detectedProfiles.set(input.sessionID, profile)

        // Extract user message text for stepbook matching
        const userMessage = output.parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text)
          .join("\n")

        const route = routeLanguage(profile, userMessage)
        if (!route) return

        activePacks.set(input.sessionID, route.pack)

        const extractor = new RepoExampleExtractor(directory)
        const examples = await extractor.extractIfNeeded()
        const examplesContext = extractor.formatForInjection()

        let languageContext = formatLanguageContext(route, profile)
        if (examplesContext) {
          languageContext += `\n\n${examplesContext}`
        }

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
          buildTool: profile.buildTool,
          stepbook: route.stepbook?.id ?? "none",
        })
      } catch (error) {
        log("[Heidi Language Intelligence] Detection failed — continuing without language context", {
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
      const commandTools = ["bash", "terminal", "execute_command", "shell"]
      if (!commandTools.some((t) => input.tool.toLowerCase().includes(t))) return

      try {
        const failureContext = formatFailureContext(pack, output.output)
        if (failureContext) {
          collector.register(input.sessionID, {
            id: "failure-diagnosis",
            source: "custom",
            content: failureContext,
            priority: "critical",
            persistent: false,
            metadata: { type: "failure-diagnosis", tool: input.tool },
          })

          log("[Heidi Language Intelligence] Failure signature matched — diagnosis injected", {
            sessionID: input.sessionID,
            tool: input.tool,
            language: pack.language,
          })
        }
      } catch {
        // Swallow — never crash on diagnosis
      }
    },
  }
}
