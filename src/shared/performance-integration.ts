/**
 * Performance Optimizations Integration
 * 
 * Central integration point for all Waves 0-4 optimizations.
 * Wires up feature flags, initializes caches, and hooks into existing systems.
 */

import type { OhMyOpenCodeConfig } from "../config/schema/oh-my-opencode-config"
import type { PluginContext } from "../plugin/types"
import { log } from "./logger"
import { perfMonitor, BaselineMetrics } from "./performance-monitor"
import { fileSystemCache } from "./file-system-cache"
import { sessionStateCache } from "./session-state-cache"
import { adaptivePoller } from "./adaptive-poller"
import { SafeProductionDefaults, AggressiveTestingSettings } from "../config/schema/performance-optimizations"
import { setRankedQueryCacheEnabled, rankedQueryCache } from "./ranked-query-cache"

export interface OptimizationIntegration {
  enabled: boolean
  config: OhMyOpenCodeConfig['performance']
  metrics: ReturnType<typeof perfMonitor.report>
}

/**
 * Initialize all performance optimizations based on config
 */
export function initializePerformanceOptimizations(
  pluginConfig: OhMyOpenCodeConfig,
  ctx: PluginContext
): OptimizationIntegration {
  const perfConfig = pluginConfig.performance
  
  // Use safe defaults if no config provided
  const effectiveConfig = perfConfig ?? SafeProductionDefaults
  
  log("[Performance] Initializing optimizations", {
    enabled: Object.entries(effectiveConfig)
      .filter(([_, v]) => v === true)
      .map(([k]) => k)
  })
  
  // Wave 0: Always enable monitoring
  if (effectiveConfig.enablePerformanceMonitoring !== false) {
    initializeMonitoring(ctx)
  }
  
  // Wave 1: Safe optimizations (enabled by default)
  if (effectiveConfig.enableFileSystemCache) {
    initializeFileSystemCache()
  }
  
  if (effectiveConfig.enableSessionStateCache) {
    initializeSessionStateCache(ctx)
  }
  
  // Wave 4: Polling consolidation
  if (effectiveConfig.enableConsolidatedPolling) {
    initializeAdaptivePoller()
  }

  setRankedQueryCacheEnabled(effectiveConfig.enableRankedQueryCache !== false)
  
  // Wave 5: Ranked query cache
  if (effectiveConfig.enableRankedQueryCache) {
    initializeRankedQueryCache()
  }
  
  return {
    enabled: true,
    config: effectiveConfig,
    metrics: perfMonitor.report()
  }
}

/**
 * Initialize performance monitoring
 */
function initializeMonitoring(ctx: PluginContext): void {
  log("[Performance] Monitoring enabled")
  
  // Report metrics periodically
  setInterval(() => {
    const report = perfMonitor.report()
    const hooksExecuted = report[BaselineMetrics.HOOK_EXECUTION_COUNT]
    
    if (hooksExecuted && hooksExecuted.count > 0) {
      log("[Performance] Metrics", {
        hooks: hooksExecuted.count,
        avgHookTime: report[BaselineMetrics.HOOK_EXECUTION]?.avg?.toFixed(2) + 'ms'
      })
    }
  }, 60000) // Log every minute
}

/**
 * Initialize file system cache
 */
function initializeFileSystemCache(): void {
  log("[Performance] File system cache enabled")
  
  // Auto-cleanup every 5 minutes
  setInterval(() => {
    fileSystemCache.cleanup()
    const stats = fileSystemCache.getStats()
    log("[Performance] File cache stats", {
      hitRate: (stats.hitRate * 100).toFixed(1) + '%',
      size: stats.size,
      evictions: stats.evictions
    })
  }, 5 * 60 * 1000)
}

/**
 * Initialize session state cache with event invalidation
 */
function initializeSessionStateCache(ctx: PluginContext): void {
  log("[Performance] Session state cache enabled")
  
  // Wire up to session events if available
  const client = ctx.client as any
  if (client?.on) {
    // Invalidate on session status changes
    client.on('session.status', (event: { sessionID: string }) => {
      sessionStateCache.invalidate(event.sessionID)
    })
    
    // Invalidate on session updates
    client.on('session.update', (event: { sessionID: string }) => {
      sessionStateCache.invalidate(event.sessionID)
    })
  }
  
  // Auto-cleanup
  setInterval(() => {
    sessionStateCache.cleanup()
    const stats = sessionStateCache.getStats()
    const size = sessionStateCache.getSize()
    log("[Performance] Session cache stats", {
      hitRate: (stats.hitRate * 100).toFixed(1) + '%',
      l1Size: size.l1,
      l2Size: size.l2
    })
  }, 30000) // Every 30 seconds
}

/**
 * Initialize adaptive poller
 */
function initializeAdaptivePoller(): void {
  log("[Performance] Adaptive polling enabled")
  
  // Will be populated by features that register pollers
  adaptivePoller.start()
}

/**
 * Initialize ranked query cache
 */
function initializeRankedQueryCache(): void {
  log("[Performance] Ranked query cache enabled")
  
  // Auto-cleanup expired entries every minute
  setInterval(() => {
    const cleaned = rankedQueryCache.cleanup()
    const stats = rankedQueryCache.getStats()
    
    if (stats.hits + stats.misses > 0) {
      log("[Performance] Ranked query cache stats", {
        hitRate: (stats.hitRate * 100).toFixed(1) + '%',
        size: stats.size,
        hits: stats.hits,
        misses: stats.misses,
        cleaned: cleaned
      })
    }
  }, 60000)
}

/**
 * Get performance report for diagnostics
 */
export function getPerformanceReport(): Record<string, unknown> {
  return {
    monitoring: perfMonitor.report(),
    fileCache: fileSystemCache.getStats(),
    sessionCache: sessionStateCache.getStats(),
    rankedQueryCache: rankedQueryCache.getStats(),
    pollers: {
      count: adaptivePoller.getPollerCount()
    }
  }
}

/**
 * Reset all performance metrics
 */
export function resetPerformanceMetrics(): void {
  perfMonitor.reset()
  log("[Performance] Metrics reset")
}

/**
 * Enable aggressive optimizations for testing
 */
export function enableAggressiveOptimizations(): void {
  log("[Performance] Enabling aggressive optimizations for testing")
  
  // Apply aggressive settings
  const aggressive = AggressiveTestingSettings
  
  // Re-initialize with aggressive settings
  initializePerformanceOptimizations(
    { performance: aggressive } as OhMyOpenCodeConfig,
    {} as PluginContext
  )
}

/**
 * Get safe default config for new users
 */
export function getSafeDefaultConfig() {
  return SafeProductionDefaults
}

// Export all optimization components
export {
  perfMonitor,
  fileSystemCache,
  sessionStateCache,
  adaptivePoller,
  rankedQueryCache
}
