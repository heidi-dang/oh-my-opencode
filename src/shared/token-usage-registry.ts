/**
 * Token Usage Registry
 * 
 * Maintains a local cache of token usage per session.
 * Used by DynamicTruncator to avoid redundant network fetches for context window usage.
 */

export interface SessionTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
  lastUpdated: number
}

const tokenUsageMap = new Map<string, SessionTokenUsage>()
const MAX_ENTRIES = 500

export const TokenUsageRegistry = {
  /**
   * Update usage for a session
   */
  update: (sessionID: string, usage: Omit<SessionTokenUsage, 'lastUpdated'>): void => {
    if (tokenUsageMap.size >= MAX_ENTRIES && !tokenUsageMap.has(sessionID)) {
      const firstKey = tokenUsageMap.keys().next().value
      if (firstKey) tokenUsageMap.delete(firstKey)
    }
    tokenUsageMap.set(sessionID, {
      ...usage,
      lastUpdated: Date.now()
    })
  },

  /**
   * Get usage for a session
   */
  get: (sessionID: string): SessionTokenUsage | undefined => {
    return tokenUsageMap.get(sessionID)
  },

  /**
   * Remove a session from the registry (cleanup)
   */
  remove: (sessionID: string): void => {
    tokenUsageMap.delete(sessionID)
  },

  /**
   * Clear all entries
   */
  clear: (): void => {
    tokenUsageMap.clear()
  }
}
