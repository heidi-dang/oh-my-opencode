import { z } from "zod"

/**
 * Performance Optimization Feature Flags
 * 
 * Wave 0-4: Per-optimization toggles for safe rollout
 */

export const PerformanceOptimizationsSchema = z.object({
  // Wave 0: Instrumentation (always enabled)
  enablePerformanceMonitoring: z.boolean().default(true),
  
  // Wave 1: Core optimizations (safe to enable)
  enableHookEventRouter: z.boolean().default(true),
  enableFileSystemCache: z.boolean().default(true),
  enablePreparedStatements: z.boolean().default(true),
  enableSetLookups: z.boolean().default(true),
  
  // Wave 2: State caching (test before enable)
  enableSessionStateCache: z.boolean().default(true),
  enableMessagePredicatePipeline: z.boolean().default(true),
  
  // Wave 3: Parallelization (careful testing required)
  enableSafeParallelization: z.boolean().default(true),
  
  // Wave 4: Cleanup (safe to enable)
  enableConsolidatedPolling: z.boolean().default(true),
  enableHoistedPatterns: z.boolean().default(true),
  
  // Wave 5: Profile-dependent (default off)
  enableRankedQueryCache: z.boolean().default(true),
}).describe("Performance optimization feature flags")

export type PerformanceOptimizations = z.infer<typeof PerformanceOptimizationsSchema>

// Safe defaults for production (ALL ENABLED)
export const SafeProductionDefaults: PerformanceOptimizations = {
  enablePerformanceMonitoring: true,
  enableHookEventRouter: true,         // Enabled - tested and verified
  enableFileSystemCache: true,         // Safe - mtime based
  enablePreparedStatements: true,      // Safe - standard practice
  enableSetLookups: true,              // Safe - no behavior change
  enableSessionStateCache: true,       // Enabled - version-based invalidation
  enableMessagePredicatePipeline: true, // Enabled - predicate-based filtering
  enableSafeParallelization: true,     // Enabled - controlled concurrency
  enableConsolidatedPolling: true,      // Enabled - adaptive intervals
  enableHoistedPatterns: true,         // Safe - minor improvement
  enableRankedQueryCache: true,       // Enabled - LRU cache with TTL
}

// Aggressive settings for testing
export const AggressiveTestingSettings: PerformanceOptimizations = {
  enablePerformanceMonitoring: true,
  enableHookEventRouter: true,
  enableFileSystemCache: true,
  enablePreparedStatements: true,
  enableSetLookups: true,
  enableSessionStateCache: true,
  enableMessagePredicatePipeline: true,
  enableSafeParallelization: true,
  enableConsolidatedPolling: true,
  enableHoistedPatterns: true,
  enableRankedQueryCache: false,      // Still needs profiling
}

// Rollout phases
export const RolloutPhases = [
  {
    name: "Phase 1: Safe Defaults",
    flags: ['enableFileSystemCache', 'enablePreparedStatements', 'enableSetLookups', 'enableHoistedPatterns'],
    duration: "1 week",
    criteria: "No regressions, stable performance"
  },
  {
    name: "Phase 2: Hook Router",
    flags: ['enableHookEventRouter'],
    duration: "1 week",
    criteria: "Hook coverage verified, 20%+ improvement"
  },
  {
    name: "Phase 3: State Caching",
    flags: ['enableSessionStateCache', 'enableMessagePredicatePipeline'],
    duration: "1 week",
    criteria: "No stale state issues, 30%+ improvement"
  },
  {
    name: "Phase 4: Parallelization",
    flags: ['enableSafeParallelization'],
    duration: "1 week",
    criteria: "No race conditions, 10%+ improvement"
  },
  {
    name: "Phase 5: Cleanup",
    flags: ['enableConsolidatedPolling'],
    duration: "1 week",
    criteria: "Polling still accurate"
  }
] as const
