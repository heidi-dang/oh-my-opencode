import { log } from "../../shared/logger"
import { ContextCollector } from "../context-injector/collector"
import { detectLanguage } from "./language-detector"
import { routeLanguage, formatLanguageContext } from "./language-router"
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

        // Get cached examples or extract if needed
        let examplesContext = cachedExamples
        if (!examplesContext || (now - examplesTimestamp) > examplesCacheTTL) {
          const [examples] = await Promise.all([
            exampleExtractor.extractIfNeeded()
          ])
          examplesContext = exampleExtractor.formatForInjection()
          cachedExamples = examplesContext
          examplesTimestamp = now
        }

        // Format and inject context
        const context = formatLanguageContext(route, profile)
        collector.register(sessionID, {
          id: "language-intelligence",
          source: "language-intelligence" as any,
          content: context,
          priority: "high",
          persistent: false
        })

      } catch (error) {
        log("[LanguageIntelligence] Error processing message", { 
          sessionID, 
          error: error instanceof Error ? error.message : String(error) 
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
      // Clean up session-specific data
      const sessionID = input.sessionID
      detectedProfiles.delete(sessionID)
      activePacks.delete(sessionID)
    }
  }
}
