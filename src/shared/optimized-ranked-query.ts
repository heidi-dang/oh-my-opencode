/**
 * Optimized Ranked Query with Cache Integration
 * 
 * Wraps MemoryDB.rankedQuery with LRU caching and profiling.
 */

import { memoryDB, MemoryQueryParams, RankedMemoryItem } from "./memory-db"
import { rankedQueryCache } from "./ranked-query-cache"
import { perfMonitor } from "./performance-monitor"
import { log } from "./logger"

interface RankedQueryOptions {
  enableCache?: boolean
  skipCache?: boolean
}

/**
 * Execute ranked query with caching
 */
export function optimizedRankedQuery(
  params: MemoryQueryParams & { path_scope?: string[]; limit?: number },
  options: RankedQueryOptions = {}
): RankedMemoryItem[] {
  const enableCache = options.enableCache ?? true
  const skipCache = options.skipCache ?? false

  // If cache disabled or explicitly skipped, run direct query
  if (!enableCache || skipCache) {
    return perfMonitor.measure('rankedQuery_uncached', () => {
      return memoryDB.rankedQuery(params)
    })
  }

  // Try cache first
  const cached = rankedQueryCache.get<RankedMemoryItem>({
    category: params.category,
    tags: params.tags,
    keyword: params.keyword,
    repo: params.repo,
    signature: params.signature,
    language: params.language,
    task_type: params.task_type,
    path_scope: params.path_scope,
    limit: params.limit
  })

  if (cached) {
    log(`[RankedQueryCache] Cache hit for ${params.category || 'all'} category`)
    return cached
  }

  // Execute and cache result
  const start = performance.now()
  const results = memoryDB.rankedQuery(params)
  const duration = performance.now() - start

  rankedQueryCache.set({
    category: params.category,
    tags: params.tags,
    keyword: params.keyword,
    repo: params.repo,
    signature: params.signature,
    language: params.language,
    task_type: params.task_type,
    path_scope: params.path_scope,
    limit: params.limit
  }, results)

  rankedQueryCache.recordLatency(duration)

  log(`[RankedQueryCache] Cache miss for ${params.category || 'all'} category (${duration.toFixed(2)}ms)`)

  return results
}

/**
 * Invalidate cache for specific category
 */
export function invalidateRankedQueryCache(category?: string): void {
  if (category) {
    rankedQueryCache.invalidateCategory(category)
    log(`[RankedQueryCache] Invalidated category: ${category}`)
  } else {
    rankedQueryCache.invalidateAll()
    log('[RankedQueryCache] Invalidated all entries')
  }
}

/**
 * Get cache statistics for profiling
 */
export function getRankedQueryCacheStats() {
  return rankedQueryCache.getStats()
}

/**
 * Reset cache statistics
 */
export function resetRankedQueryCacheStats(): void {
  // Stats are automatically tracked, this is a no-op for API compatibility
  log('[RankedQueryCache] Stats reset requested')
}
