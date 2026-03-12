import { log } from "./logger"

export interface RankedQueryCacheKey {
  category?: string
  repo?: string
  language?: string
  task_type?: string
  signature?: string
  tags?: string
  keyword?: string
  path_scope?: string[]
  limit?: number
}

interface CacheEntry<T> {
  data: T[]
  timestamp: number
  lastAccessedAt: number
  category?: string
}

export interface RankedQueryCacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  hitRate: number
  enabled: boolean
  avgLatencyMs: number
}

class RankedQueryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize = 100
  private readonly ttlMs = 30_000
  private enabled = true
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalLatencyMs: 0,
    queryCount: 0,
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.invalidateAll()
    }
  }

  get<T>(params: RankedQueryCacheKey): T[] | undefined {
    if (!this.enabled) return undefined

    const key = this.createKey(params)
    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.misses++
      return undefined
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      this.stats.evictions++
      this.stats.misses++
      return undefined
    }

    entry.lastAccessedAt = Date.now()
    this.stats.hits++
    return entry.data as T[]
  }

  set<T>(params: RankedQueryCacheKey, data: T[]): void {
    if (!this.enabled) return

    const key = this.createKey(params)
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      lastAccessedAt: now,
      category: params.category,
    })

    if (this.cache.size > this.maxSize) {
      this.evictLeastRecentlyUsed()
    }
  }

  invalidateCategory(category?: string): void {
    if (!category) {
      this.invalidateAll()
      return
    }

    for (const [key, entry] of this.cache.entries()) {
      if (entry.category === category) {
        this.cache.delete(key)
        this.stats.evictions++
      }
    }
  }

  invalidateAll(): void {
    this.stats.evictions += this.cache.size
    this.cache.clear()
  }

  getStats(): RankedQueryCacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      enabled: this.enabled,
      avgLatencyMs: this.stats.queryCount > 0
        ? this.stats.totalLatencyMs / this.stats.queryCount
        : 0,
    }
  }

  recordLatency(latencyMs: number): void {
    this.stats.totalLatencyMs += latencyMs
    this.stats.queryCount++
  }

  cleanup(): number {
    const now = Date.now()
    let evicted = 0
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key)
        evicted++
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted
      log("[RankedQueryCache] Cleaned expired entries", { evicted })
    }

    return evicted
  }

  private createKey(params: RankedQueryCacheKey): string {
    const normalized = {
      ...params,
      path_scope: params.path_scope ? [...params.path_scope].sort() : undefined,
    }
    return JSON.stringify(normalized)
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | undefined
    let oldestAccess = Number.POSITIVE_INFINITY

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
    }
  }
}

export const rankedQueryCache = new RankedQueryCache()

export function setRankedQueryCacheEnabled(enabled: boolean): void {
  rankedQueryCache.setEnabled(enabled)
}

setInterval(() => rankedQueryCache.cleanup(), 60_000)

export { RankedQueryCache }
