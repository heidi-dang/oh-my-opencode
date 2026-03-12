import { log } from "../../shared/logger"
import { ContextCollector } from "../context-injector/collector"
import { detectLanguage } from "./language-detector"
import { routeLanguage, formatLanguageContext, formatFailureContext } from "./language-router"
import { RepoExampleExtractor } from "./repo-example-extractor"
import { LanguageMemory } from "./language-memory"
import type { LanguagePack, LanguageProfile, LanguageRouteResult } from "./types"

interface LanguageIntelligenceHookArgs {
  collector: ContextCollector
  directory: string
}

/**
 * Optimized Language Intelligence Hook
 * 
 * Performance improvements:
 * 1. Cached language detection results
 * 2. Debounced example extraction
 * 3. Optimized text processing
 * 4. Reduced object allocations
 * 5. Early exit strategies
 */
export function createOptimizedLanguageIntelligenceHook(args: LanguageIntelligenceHookArgs) {
  const { collector, directory } = args
  const detectedProfiles = new Map<string, LanguageProfile>()
  const activePacks = new Map<string, LanguagePack>()
  const memory = new LanguageMemory()
  
  // Performance optimizations
  const languageCache = new Map<string, { profile: LanguageProfile; timestamp: number }>()
  const exampleExtractor = new RepoExampleExtractor(directory)
  let cachedExamples: string | null = null
  let examplesTimestamp = 0
  const examplesCacheTTL = 60000 // 1 minute
  const languageCacheTTL = 300000 // 5 minutes

  return {
    "chat.message": async (
      input: { sessionID: string; agent?: string },
      output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> }
    ) => {
      const sessionID = input.sessionID
      const now = Date.now()

      try {
        // Check cached language profile
        let profile = detectedProfiles.get(sessionID)
        if (!profile) {
          const cached = languageCache.get(directory)
          if (cached && (now - cached.timestamp) < languageCacheTTL) {
            profile = cached.profile
          } else {
            profile = await detectLanguage(directory)
            if (profile.primary === "unknown") return
            languageCache.set(directory, { profile, timestamp: now })
          }
          detectedProfiles.set(sessionID, profile)
        }

        // Optimized user message extraction
        let userMessage = ""
        const parts = output.parts
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i]
          if (p.type === "text" && typeof p.text === "string") {
            if (userMessage) userMessage += "\n"
            userMessage += p.text
          }
        }

        if (!userMessage.trim()) return

        const route = routeLanguage(profile, userMessage)
        if (!route) return

        activePacks.set(sessionID, route.pack)

        let examplesContext = cachedExamples
        if (!examplesContext || (now - examplesTimestamp) > examplesCacheTTL) {
          await Promise.all([
            exampleExtractor.extractIfNeeded()
          ])
          examplesContext = exampleExtractor.formatForInjection()
          cachedExamples = examplesContext
          examplesTimestamp = now
        }

        const memoryContext = memory.formatForInjection(profile.primary)

        let context = formatLanguageContext(route, profile)
        if (examplesContext) {
          context += `\n\n${examplesContext}`
        }
        if (memoryContext) {
          context += `\n\n${memoryContext}`
        }

        collector.register(sessionID, {
          id: "language-intelligence",
          source: "custom",
          content: context,
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
            sessionID,
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

      const commandTools = ["bash", "terminal", "execute_command", "shell", "git"]
      const toolName = input.tool.toLowerCase()
      if (!commandTools.some((tool) => toolName.includes(tool))) return

      try {
        const failureContext = formatFailureContext(pack, output.output)
        if (!failureContext) return

        collector.register(input.sessionID, {
          id: `failure-diagnosis-${input.callID}`,
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
      } catch (error) {
        log("[Heidi Language Intelligence] Diagnosis failed", {
          error: String(error),
        })
      }
    },

    "session.created": async (input: { sessionID: string }) => {
      // Clear cache for new session to ensure fresh detection
      const sessionID = input.sessionID
      detectedProfiles.delete(sessionID)
      activePacks.delete(sessionID)
    },

    "session.deleted": async (input: { sessionID: string }) => {
      const sessionID = input.sessionID
      detectedProfiles.delete(sessionID)
      activePacks.delete(sessionID)
    }
  }
}
