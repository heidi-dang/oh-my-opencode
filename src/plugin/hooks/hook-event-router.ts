/**
 * Hook Event Router
 * 
 * Wave 1: Optimized hook execution with event filtering
 * 
 * Features:
 * - Event-to-hook mapping (skip irrelevant hooks)
 * - Priority-based execution
 * - Safe fallback for unknown events
 * - Required hook protection
 */

import { perfMonitor, BaselineMetrics } from "../../shared/performance-monitor"
import { log } from "../../shared/logger"

export type HookFunction = (input: unknown, output: unknown) => unknown | Promise<unknown>

export interface Hook {
  name: string
  execute: HookFunction
}

export interface HookMetadata {
  priority: number        // Lower = earlier
  events: string[] | 'all'
  required: boolean      // If true, never skip
  category: 'guard' | 'transform' | 'utility' | 'background'
}

// Hook classification database
export const HOOK_METADATA: Map<string, HookMetadata> = new Map([
  // Guard hooks - required, run on all events
  ['writeExistingFileGuard', { priority: 0, events: 'all', required: true, category: 'guard' }],
  ['rulesInjector', { priority: 1, events: ['tool.execute.before', 'experimental.chat.system.transform'], required: true, category: 'guard' }],
  ['critiqueGate', { priority: 2, events: 'all', required: true, category: 'guard' }],
  
  // Transform hooks - event-specific
  ['keywordDetector', { priority: 10, events: ['chat.message', 'experimental.chat.messages.transform'], required: false, category: 'transform' }],
  ['contextInjector', { priority: 11, events: ['experimental.chat.messages.transform', 'experimental.chat.system.transform'], required: false, category: 'transform' }],
  ['thinkingBlockValidator', { priority: 12, events: ['experimental.chat.messages.transform'], required: true, category: 'transform' }],
  
  // Session lifecycle hooks
  ['contextWindowMonitor', { priority: 20, events: ['session.idle'], required: false, category: 'utility' }],
  ['preemptiveCompaction', { priority: 21, events: ['session.idle'], required: false, category: 'utility' }],
  ['todoContinuationEnforcer', { priority: 22, events: ['session.idle'], required: false, category: 'utility' }],
  ['sessionRecovery', { priority: 23, events: ['session.error', 'session.idle'], required: true, category: 'utility' }],
  
  // Chat message hooks
  ['thinkMode', { priority: 30, events: ['chat.params'], required: false, category: 'utility' }],
  ['autoSlashCommand', { priority: 31, events: ['chat.message'], required: false, category: 'utility' }],
  ['categorySkillReminder', { priority: 32, events: ['chat.message'], required: false, category: 'utility' }],
  
  // Tool hooks
  ['commentChecker', { priority: 40, events: ['tool.execute.after'], required: false, category: 'utility' }],
  ['toolOutputTruncator', { priority: 41, events: ['tool.execute.after'], required: false, category: 'utility' }],
  ['editErrorRecovery', { priority: 42, events: ['tool.execute.after'], required: false, category: 'utility' }],
  
  // Background hooks
  ['autoUpdateChecker', { priority: 100, events: ['session.created'], required: false, category: 'background' }],
  ['agentUsageReminder', { priority: 101, events: ['session.created'], required: false, category: 'background' }],
])

// Event-to-hooks mapping for fast lookup
export const EVENT_HOOK_MAP: Map<string, Set<string>> = new Map()

// Build reverse mapping from metadata
function buildEventHookMap(): void {
  EVENT_HOOK_MAP.clear()
  for (const [hookName, meta] of HOOK_METADATA.entries()) {
    if (meta.events === 'all') {
      // These hooks run on all events - skip from specific mapping
      continue
    }
    
    for (const event of meta.events) {
      let hooks = EVENT_HOOK_MAP.get(event)
      if (!hooks) {
        hooks = new Set()
        EVENT_HOOK_MAP.set(event, hooks)
      }
      hooks.add(hookName)
    }
  }
}

function hookMatchesEvent(hookName: string, meta: HookMetadata | undefined, event: string): boolean {
  if (meta?.required) return true
  if (meta?.events === 'all') return true
  
  const relevantHookNames = EVENT_HOOK_MAP.get(event)
  if (relevantHookNames) {
    return relevantHookNames.has(hookName)
  }
  
  return !meta
}

// Initialize on load
buildEventHookMap()

export interface HookRouterOptions {
  logSkipped?: boolean
  measurePerformance?: boolean
  featureEnabled?: boolean  // Feature flag
}

/**
 * Execute hooks for a specific event with filtering and priority
 */
export function executeHooksForEvent(
  event: string,
  hooks: Hook[],
  input: unknown,
  output: unknown,
  options: HookRouterOptions = {}
): void | Promise<void> {
  const { 
    logSkipped = false, 
    measurePerformance = true,
    featureEnabled = true 
  } = options
  
  // If feature disabled, run all hooks sequentially (fallback)
  if (!featureEnabled) {
    for (const hook of hooks) {
      try {
        const result = hook.execute(input, output)
        if (result && typeof result === 'object' && 'stopPropagation' in result) {
          if ((result as { stopPropagation: boolean }).stopPropagation) break
        }
      } catch (error) {
        log(`[HookRouter] Error in ${hook.name}:`, error)
      }
    }
    return
  }
  
  // Get hooks relevant to this event
  // Determine which hooks to run
  const hooksToRun = hooks.filter(hook => {
    const meta = HOOK_METADATA.get(hook.name)
    const shouldRun = hookMatchesEvent(hook.name, meta, event)

    if (!shouldRun && logSkipped) {
      log(`[HookRouter] Skipping ${hook.name} for ${event}`)
    }

    return shouldRun
  })
  
  // Sort by priority
  hooksToRun.sort((a, b) => {
    const metaA = HOOK_METADATA.get(a.name)
    const metaB = HOOK_METADATA.get(b.name)
    return (metaA?.priority ?? 100) - (metaB?.priority ?? 100)
  })
  
  // Execute with optional performance measurement
  for (const hook of hooksToRun) {
    try {
      let result: unknown
      
      if (measurePerformance) {
        result = perfMonitor.measure(`${BaselineMetrics.HOOK_EXECUTION}.${hook.name}`, () => {
          return hook.execute(input, output)
        })
      } else {
        result = hook.execute(input, output)
      }
      
      // Handle async results
      if (result && typeof result === 'object' && 'then' in result) {
        (result as Promise<unknown>).then(resolved => {
          if (resolved && typeof resolved === 'object' && 'stopPropagation' in resolved) {
            if ((resolved as { stopPropagation: boolean }).stopPropagation) {
              return // Stop execution
            }
          }
        }).catch(error => {
          log(`[HookRouter] Async error in ${hook.name}:`, error)
        })
      } else {
        // Sync result
        if (result && typeof result === 'object' && 'stopPropagation' in result) {
          if ((result as { stopPropagation: boolean }).stopPropagation) {
            break // Stop execution
          }
        }
      }
    } catch (error) {
      log(`[HookRouter] Error in ${hook.name}:`, error)
      // Continue with other hooks
    }
  }
  
  // Record count
  perfMonitor.measure(`${BaselineMetrics.HOOK_EXECUTION_COUNT}`, () => {
    // Just to increment counter
  })
}

/**
 * Check if a hook should run for a specific event
 */
export function shouldHookRunForEvent(hookName: string, event: string): boolean {
  const meta = HOOK_METADATA.get(hookName)
  return hookMatchesEvent(hookName, meta, event)
}

/**
 * Get hooks by category
 */
export function getHooksByCategory(category: HookMetadata['category']): string[] {
  const result: string[] = []
  for (const [name, meta] of HOOK_METADATA.entries()) {
    if (meta.category === category) {
      result.push(name)
    }
  }
  return result
}

/**
 * Validate hook coverage
 * Returns events that have no explicit hook mapping
 */
export function validateHookCoverage(events: string[]): {
  covered: string[]
  uncovered: string[]
} {
  buildEventHookMap()
  const covered: string[] = []
  const uncovered: string[] = []
  
  for (const event of events) {
    if (EVENT_HOOK_MAP.has(event)) {
      covered.push(event)
    } else {
      uncovered.push(event)
    }
  }
  
  return { covered, uncovered }
}
