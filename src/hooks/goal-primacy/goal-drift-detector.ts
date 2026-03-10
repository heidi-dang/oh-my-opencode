import { log } from "../../shared/logger"

interface DriftEntry {
  score: number
  timestamp: number
}

const DRIFT_THRESHOLD = 0.30
const CONSECUTIVE_DRIFT_LIMIT = 3
const sessionDriftHistory = new Map<string, DriftEntry[]>()

export function computeKeywordOverlap(goalText: string, toolOutput: string): number {
  if (!goalText || !toolOutput) return 1.0

  const extractKeywords = (text: string): Set<string> => {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)

    const stopWords = new Set([
      "this", "that", "from", "with", "have", "been", "will", "must",
      "should", "would", "could", "their", "there", "here", "about",
      "into", "more", "some", "then", "than", "them", "when", "what",
      "which", "your", "each", "make", "like", "just", "over", "such",
      "also", "back", "after", "only", "most", "very", "does", "before",
    ])

    return new Set(words.filter((w) => !stopWords.has(w)))
  }

  const goalKeywords = extractKeywords(goalText)
  const outputKeywords = extractKeywords(toolOutput)

  if (goalKeywords.size === 0) return 1.0

  let matchCount = 0
  for (const keyword of goalKeywords) {
    if (outputKeywords.has(keyword)) matchCount++
  }

  return matchCount / goalKeywords.size
}

export function trackDriftScore(sessionID: string, score: number): void {
  const history = sessionDriftHistory.get(sessionID) ?? []
  history.push({ score, timestamp: Date.now() })

  // Keep only last 10 entries to prevent unbounded growth
  if (history.length > 10) {
    history.splice(0, history.length - 10)
  }

  sessionDriftHistory.set(sessionID, history)
}

export function isDrifting(sessionID: string): boolean {
  const history = sessionDriftHistory.get(sessionID)
  if (!history || history.length < CONSECUTIVE_DRIFT_LIMIT) return false

  const recentEntries = history.slice(-CONSECUTIVE_DRIFT_LIMIT)
  const allBelowThreshold = recentEntries.every((e) => e.score < DRIFT_THRESHOLD)

  if (allBelowThreshold) {
    log(`[goal-drift-detector] DRIFT DETECTED for session ${sessionID}`, {
      recentScores: recentEntries.map((e) => e.score),
      threshold: DRIFT_THRESHOLD,
    })
  }

  return allBelowThreshold
}

export function clearDriftHistory(sessionID: string): void {
  sessionDriftHistory.delete(sessionID)
}
