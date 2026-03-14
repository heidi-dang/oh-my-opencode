import type { FallbackEntry } from "../../shared/model-requirements"

export type BackgroundTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "cancelled"
  | "interrupt"

export interface TaskProgress {
  toolCalls: number
  lastTool?: string
  lastUpdate: Date
  lastMessage?: string
  lastMessageAt?: Date
  phase?: string
  percent?: number
  message?: string
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheCreationInputTokens?: number
    cacheReadInputTokens?: number
  }
}

export interface BackgroundTask {
  id: string
  sessionID?: string
  parentSessionID: string
  parentMessageID: string
  description: string
  prompt: string
  agent: string
  status: BackgroundTaskStatus
  queuedAt?: Date
  startedAt?: Date
  completedAt?: Date
  result?: string
  error?: string
  progress?: TaskProgress
  parentModel?: { providerID: string; modelID: string }
  model?: { providerID: string; modelID: string; variant?: string }
  /** Fallback chain for runtime retry on model errors */
  fallbackChain?: FallbackEntry[]
  /** Number of fallback retry attempts made */
  attemptCount?: number
  /** Active concurrency slot key */
  concurrencyKey?: string
  /** Persistent key for re-acquiring concurrency on resume */
  concurrencyGroup?: string
  /** Parent session's agent name for notification */
  parentAgent?: string
  /** Parent session's tool restrictions for notification prompts */
  parentTools?: Record<string, boolean>
  /** Marks if the task was launched from an unstable agent/category */
  isUnstableAgent?: boolean
  /** Category used for this task (e.g., 'quick', 'visual-engineering') */
  category?: string

  /** Explicit fallback model to use if the primary model fails */
  fallbackModel?: string
  /** Files affected by this task (collected from sub-agent session) */
  affectedFiles?: string[]
  /** Cumulative token usage for this task's session */
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheCreationInputTokens?: number
    cacheReadInputTokens?: number
  }
}

export interface LaunchInput {
  id?: string
  description: string
  prompt: string
  agent: string
  parentSessionID: string
  parentMessageID: string
  parentModel?: { providerID: string; modelID: string }
  parentAgent?: string
  parentTools?: Record<string, boolean>
  model?: { providerID: string; modelID: string; variant?: string }
  /** Fallback chain for runtime retry on model errors */
  fallbackChain?: FallbackEntry[]
  fallbackModel?: string
  isUnstableAgent?: boolean
  skills?: string[]
  skillContent?: string
  category?: string
}

export interface ResumeInput {
  sessionId: string
  prompt: string
  parentSessionID: string
  parentMessageID: string
  parentModel?: { providerID: string; modelID: string }
  parentAgent?: string
  parentTools?: Record<string, boolean>
  fallbackModel?: string
}
