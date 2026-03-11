export const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
export const INLINE_CODE_PATTERN = /`[^`]+`/g

// Re-export from submodules
export { isPlannerAgent, getUltraworkMessage } from "./ultrawork"
export { SEARCH_PATTERN, SEARCH_MESSAGE } from "./search"
export { ANALYZE_PATTERN, ANALYZE_MESSAGE } from "./analyze"
export { ISSUE_PATTERN, ISSUE_MESSAGE } from "./issue"
export { DEBUG_PATTERN, DEBUG_MESSAGE } from "./debug"

import { getUltraworkMessage } from "./ultrawork"
import { SEARCH_PATTERN, SEARCH_MESSAGE } from "./search"
import { ANALYZE_PATTERN, ANALYZE_MESSAGE } from "./analyze"
import { ISSUE_PATTERN, ISSUE_MESSAGE } from "./issue"
import { DEBUG_PATTERN, DEBUG_MESSAGE } from "./debug"

export type KeywordDetector = {
  pattern: RegExp
  message: string | ((agentName?: string, modelID?: string) => string)
}

export const KEYWORD_DETECTORS: KeywordDetector[] = [
  {
    pattern: /\b(ultrawork|ulw)\b/i,
    message: getUltraworkMessage,
  },
  {
    pattern: SEARCH_PATTERN,
    message: SEARCH_MESSAGE,
  },
  {
    pattern: ANALYZE_PATTERN,
    message: ANALYZE_MESSAGE,
  },
  {
    pattern: ISSUE_PATTERN,
    message: ISSUE_MESSAGE,
  },
  {
    pattern: DEBUG_PATTERN,
    message: DEBUG_MESSAGE,
  },
]
