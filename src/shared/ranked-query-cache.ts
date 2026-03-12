/**
 * Ranked Query Cache (Wave 5)
 * 
 * Caches ranked memory query results to avoid recomputing expensive scoring.
 * 
 * Features:
 * - LRU eviction with configurable max size
 * - TTL-based invalidation (default: 30 seconds for ranked queries)
 * - Cache key based on normalized query parameters
 * - Profiling hooks for hit/miss metrics
 * - Write-through invalidation on memory updates
 * 
 * Expected improvement: 50-80% reduction in ranked query latency for repeated queries
 */

import { log } from "./logger"
import { perfMonitor } from "./performance-monitor"

interface CacheEntry<T> {
  data: T
  timestamp: number
  hits: number
  lastAccessed: number
}

interface RankedQueryCacheConfig {
  maxSize: number
  ttlMs: number
  enableProfiling: boolean
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  hitRate: number
  size: number
  avgLatencyMs: number
}

interface QueryCacheKey {
  category?: string
  tags?: string
  keyword?: string
  repo?: string
  signature?: string
  language?: string
  task_type?: string
  path_scope?: string[]
  limit?: number
}

class RankedQueryCache {
  private cache = new Map<string, CacheEntry<any[]>>()
  private config: RankedQueryCacheConfig
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalLatencyMs: 0,
    queryCount: 0
  }

  constructor(config: Partial<RankedQueryCacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 100,
      ttlMs: config.ttlMs ?? 30000, // 30 seconds default
      enableProfiling: config.enableProfiling ?? true
    }
  }

  /**
   * Generate cache key from query parameters
   */
  private generateKey(params: QueryCacheKey): string {
    // Normalize and sort for consistent keys
    const normalized: Record<string, string | number | undefined> = {}
    
    if (params.category) normalized.category = params.category
    if (params.tags) normalized.tags = params.tags.toLowerCase().trim()
    if (params.keyword) normalized.keyword = params.keyword.toLowerCase().trim()
    if (params.repo) normalized.repo = params.repo
    if (params.signature) normalized.signature = params.signature
    if (params.language) normalized.language = params.language
    if (params.task_type) normalized.task_type = params.task_type
    if (params.path_scope?.length) {
      normalized.path_scope = params.path_scope.sort().join(",")
    }
    normalized.limit = params.limit ?? 10

    return JSON.stringify(normalized)
  }

  /**
   * Get cached result if valid
   */
  get<T>(params: QueryCacheKey): T[] | undefined {
    const key = this.generateKey(params)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // Check TTL
    const now = Date.now()
    if (now - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key)
      this.stats.misses++
      return undefined
    }

    // Update access tracking
    entry.hits++
    entry.lastAccessed = now
    this.stats.hits++

    return entry.data as T[]
  }

  /**
   * Store result in cache
   */
  set<T>(params: QueryCacheKey, data: T[]): void {
    const key = this.generateKey(params)
    const now = Date.now()

    // Evict if at capacity (LRU - remove least recently accessed)
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      hits: 0,
      lastAccessed: now
    })
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldest: { key: string; lastAccessed: number } | null = null

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = { key, lastAccessed: entry.lastAccessed }
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key)
      this.stats.evictions++
    }
  }

  /**
   * Invalidate cache entries matching category
   */
  invalidateCategory(category: string): void {
    let count = 0
    for (const [key, entry] of this.cache.entries()) {
      const params = JSON.parse(key) as QueryCacheKey
      if (params.category === category) {
        this.cache.delete(key)
        count++
      }
    }
    
    if (count > 0 && this.config.enableProfiling) {
      log(`[RankedQueryCache] Invalidated ${count} entries for category: ${category}`)
    }
  }

  /**
   * Invalidate entire cache
   */
  invalidateAll(): void {
    const size = this.cache.size
    this.cache.clear()
    
    if (size > 0 && this.config.enableProfiling) {
      log(`[RankedQueryCache] Invalidated all ${size} entries`)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      avgLatencyMs: this.stats.queryCount > 0 
        ? this.stats.totalLatencyMs / this.stats.queryCount 
        : 0
    }
  }

  /**
   * Record query latency for profiling
   */
  recordLatency(latencyMs: number): void {
    this.stats.totalLatencyMs += latencyMs
    this.stats.queryCount++
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Cleanup expired entries (can be called periodically)
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }
}

// Singleton instance
export const rankedQueryCache = new RankedQueryCache({
  maxSize: 100,
  ttlMs: 30000, // 30 seconds
  enableProfiling: true
})

// Export for testing
export { RankedQueryCache, QueryCacheKey, CacheStats }
