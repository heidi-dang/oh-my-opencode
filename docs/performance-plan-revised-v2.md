# Production-Safe Performance Optimization Plan
## Target: 2-4X Hot-Path Improvement

**Date**: March 12, 2026  
**Status**: Ready for Implementation  
**Scope**: Hot-path performance with safety-first approach

---

## Executive Summary

This plan targets **2-4X improvement in hot paths** through production-safe optimizations that have been reviewed for correctness risks. The 10X framing has been removed in favor of realistic, measurable targets.

### Realistic Targets (Per Measurement)

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Hook execution overhead | 100ms (p95) | 50-70ms (p95) | Measured per event |
| File I/O per turn | 50 reads | 10-15 reads | mtime-based cache |
| Session state API calls | 100/min | 40-60/min | Event-driven cache |
| DB query time | 5ms avg | 3-4ms avg | Prepared statements |
| **Overall hot-path** | Baseline | **2-4X faster** | End-to-end timing |

---

## Wave 0: Instrumentation First (Week 1)

**Before any optimization, measure current state.**

### 0.1 Add Performance Counters

```typescript
// src/shared/performance-monitor.ts
class PerformanceMonitor {
  private counters = new Map<string, { count: number; totalTime: number }>()
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start
    
    const existing = this.counters.get(name) || { count: 0, totalTime: 0 }
    existing.count++
    existing.totalTime += duration
    this.counters.set(name, existing)
    
    return result
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    
    const existing = this.counters.get(name) || { count: 0, totalTime: 0 }
    existing.count++
    existing.totalTime += duration
    this.counters.set(name, existing)
    
    return result
  }
  
  report(): Record<string, { count: number; avg: number; p95: number }> {
    // Calculate and return metrics
  }
}

export const perfMonitor = new PerformanceMonitor()
```

### 0.2 Baseline Metrics to Capture

```typescript
// Track these before any optimization:
interface BaselineMetrics {
  // Hook execution
  hooksPerEvent: Map<string, { count: number; latency: number }>
  
  // File I/O
  fileReadsPerTurn: number
  fileReadLatency: { p50: number; p95: number }
  
  // Session state
  sessionStateFetchesPerMinute: number
  sessionStateLatency: { p50: number; p95: number }
  
  // Database
  dbQueriesPerTurn: number
  dbQueryLatency: { p50: number; p95: number }
  
  // Message transforms
  transformsPerMessage: number
  transformLatency: { p50: number; p95: number }
  
  // Memory
  heapUsageAfter30Min: number
  gcFrequency: number
}
```

### 0.3 Benchmark Harness

```typescript
// test/performance/benchmark-harness.ts
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  options: {
    warmup: number
    iterations: number
    discardOutliers: number
  }
): Promise<{
  p50: number
  p95: number
  p99: number
  stdDev: number
}> {
  // Warmup
  for (let i = 0; i < options.warmup; i++) {
    await fn()
  }
  
  // Measure
  const times: number[] = []
  for (let i = 0; i < options.iterations; i++) {
    if (global.gc) global.gc() // Isolate GC
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  
  // Discard outliers
  times.sort((a, b) => a - b)
  const discardCount = Math.floor(times.length * options.discardOutliers)
  const cleanTimes = times.slice(discardCount, times.length - discardCount)
  
  // Calculate stats
  return {
    p50: percentile(cleanTimes, 0.5),
    p95: percentile(cleanTimes, 0.95),
    p99: percentile(cleanTimes, 0.99),
    stdDev: standardDeviation(cleanTimes)
  }
}
```

### 0.4 Success Criteria Definition

Before implementation, define for each optimization:
- **Acceptance threshold**: Minimum improvement to merge
- **Rejection threshold**: If performance degrades by X%, reject
- **Correctness criteria**: What must still work correctly

Example:
```typescript
const acceptanceCriteria = {
  hookFiltering: {
    minImprovement: '20%',
    maxRegression: '5%',
    correctness: [
      'All existing hooks run when needed',
      'No new hook suppression bugs',
      'Event-to-hook mapping verified'
    ]
  },
  fileSystemCache: {
    minImprovement: '40%',
    maxRegression: '5%',
    correctness: [
      'File changes detected immediately',
      'No stale content served',
      'Cache hit rate > 80%'
    ]
  }
}
```

---

## Wave 1: Core Optimizations (Week 2-3)

### 1.1 Hook Event Filtering with Fallback

**Feature Flag**: `enableHookEventRouter`

```typescript
// src/plugin/hooks/hook-event-router.ts

// Event-to-hooks mapping - explicit only
const EVENT_HOOK_MAP = new Map<string, Set<HookName>>([
  ["session.idle", new Set([
    "contextWindowMonitor",
    "preemptiveCompaction", 
    "sessionRecovery",
    "sessionNotification",
    "todoContinuationEnforcer",
    "unstableAgentBabysitter",
    "backgroundNotificationHook",
    "atlasHook"
  ])],
  ["chat.message", new Set([
    "keywordDetector", 
    "autoSlashCommand",
    "categorySkillReminder",
    "noSisyphusGpt",
    "noHephaestusNonGpt",
    "taskResumeInfo"
  ])],
  // ... other known events
])

// Hook classification
interface HookMetadata {
  name: HookName
  priority: number
  events: string[] | 'all'  // 'all' = runs on every event
  required: boolean        // true = never skip
}

const HOOK_METADATA = new Map<HookName, HookMetadata>([
  ['writeExistingFileGuard', { priority: 0, events: ['tool.execute.before'], required: true }],
  ['rulesInjector', { priority: 1, events: ['tool.execute.before', 'experimental.chat.system.transform'], required: true }],
  ['keywordDetector', { priority: 10, events: ['chat.message', 'experimental.chat.messages.transform'], required: false }],
  // ... classify all hooks
])

export function executeHooksForEvent(
  event: string,
  hooks: HookFunction[],
  input: unknown,
  output: unknown,
  options: { logSkipped?: boolean } = {}
): void {
  const relevant = EVENT_HOOK_MAP.get(event)
  
  // Determine which hooks to run
  const hooksToRun = hooks.filter(hook => {
    const meta = HOOK_METADATA.get(hook.name)
    
    // Required hooks always run
    if (meta?.required) return true
    
    // If event is in map, only run if explicitly listed
    if (relevant) {
      const shouldRun = relevant.has(hook.name)
      if (!shouldRun && options.logSkipped) {
        log(`[HookRouter] Skipping ${hook.name} for ${event}`)
      }
      return shouldRun
    }
    
    // Unknown event: safe fallback
    // Run hooks that are marked for 'all' events or have no metadata (legacy)
    return meta?.events === 'all' || !meta
  })
  
  // Sort by priority
  hooksToRun.sort((a, b) => {
    const metaA = HOOK_METADATA.get(a.name)
    const metaB = HOOK_METADATA.get(b.name)
    return (metaA?.priority ?? 100) - (metaB?.priority ?? 100)
  })
  
  // Execute
  for (const hook of hooksToRun) {
    try {
      const result = hook(input, output) as { stopPropagation?: boolean } | undefined
      if (result?.stopPropagation) break
    } catch (error) {
      log(`[HookRouter] Error in ${hook.name}:`, error)
      // Continue with other hooks
    }
  }
}
```

**Correctness Checks**:
1. All required hooks run on every event
2. No suppression of guard/enforcement hooks
3. Unknown events trigger safe fallback
4. Logging during rollout to detect unexpected skips

**Metrics to Track**:
- Hooks executed per event (should decrease)
- Hook latency per event (should decrease)
- No increase in "skipped required hook" errors

---

### 1.2 File I/O Cache

**Feature Flag**: `enableFileSystemCache`

```typescript
// src/shared/file-system-cache.ts (already created, no changes needed)
// Uses mtime + size for validation
// 5 minute TTL
// LRU eviction at 100 entries
```

**Correctness Checks**:
1. File modifications detected within 1 second
2. Cache hit rate > 80% in steady state
3. No staleness in AGENTS.md / SKILL.md content
4. Memory usage bounded (max 100 entries)

---

### 1.3 Database Prepared Statements

**Feature Flag**: `enablePreparedStatements`

```typescript
// src/features/context-injector/optimized-db.ts (already created, no changes needed)
// Prepared statement reuse
// Immediate transaction grouping (no delayed batching)
```

**Correctness Checks**:
1. All writes still atomic
2. No SQLITE_BUSY errors
3. Query results identical to before
4. Statement cleanup on close

---

## Wave 2: State Caching (Week 4)

### 2.1 Session State Cache with Version

**Feature Flag**: `enableSessionStateCache`

```typescript
// src/shared/session-state-cache.ts (revision: prefer version over TTL)

class SessionStateCache {
  private cache = new Map<string, CacheEntry>()
  private versions = new Map<string, number>()
  private readonly SAFETY_TTL_MS = 5000 // Safety net only
  
  // Primary: Version-based (explicit invalidation)
  get(sessionID: string, expectedVersion?: number): CachedSessionState | undefined {
    const entry = this.cache.get(sessionID)
    if (!entry) return undefined
    
    // Primary: Version match
    if (expectedVersion !== undefined) {
      if (entry.version === expectedVersion) {
        return entry.data
      }
      // Version mismatch - stale
      this.cache.delete(sessionID)
      return undefined
    }
    
    // Secondary: TTL safety net (for observational paths)
    if (Date.now() - entry.updatedAt > this.SAFETY_TTL_MS) {
      this.cache.delete(sessionID)
      return undefined
    }
    
    return entry.data
  }
  
  // Explicit invalidation - PRIMARY mechanism
  invalidate(sessionID: string): void {
    this.cache.delete(sessionID)
    this.versions.delete(sessionID)
  }
  
  set(sessionID: string, state: CachedSessionState): void {
    const version = state.version || this.getNextVersion(sessionID)
    this.cache.set(sessionID, {
      data: { ...state, version },
      version,
      updatedAt: Date.now()
    })
    this.versions.set(sessionID, version)
  }
}

// Event-driven invalidation
on("session.status", (event) => {
  sessionStateCache.invalidate(event.sessionID)
})

on("session.update", (event) => {
  sessionStateCache.invalidate(event.sessionID)
})

// Usage for guard paths: prefer fresh
function getSessionStateForGuard(sessionID: string) {
  // Don't use cache for enforcement decisions
  return fetchFreshFromAPI(sessionID)
}

// Usage for observational paths: can use cache
function getSessionStateForBackground(sessionID: string) {
  const cached = sessionStateCache.get(sessionID)
  if (cached) return cached
  
  const fresh = fetchFreshFromAPI(sessionID)
  sessionStateCache.set(sessionID, fresh)
  return fresh
}
```

**Correctness Checks**:
1. State changes visible immediately after invalidation
2. Guard/gating paths use fresh reads (not cached)
3. TTL only used for observational paths
4. Version validation for optimistic concurrency

---

### 2.2 Message Transform Predicate Pipeline

**Feature Flag**: `enableMessagePredicatePipeline`

```typescript
// src/plugin/handlers/optimized-messages-transform.ts

interface Transform {
  name: string
  predicate: (msg: Message) => boolean  // Skip if false
  transform: (msg: Message) => Message | null
  priority: number
  required: boolean  // If true, predicate must pass
}

class MessageTransformPipeline {
  private transforms: Transform[] = []
  
  addTransform(t: Transform) {
    this.transforms.push(t)
    this.transforms.sort((a, b) => a.priority - b.priority)
  }
  
  process(messages: Message[]): Message[] {
    const results: Message[] = []
    
    for (const msg of messages) {
      let current = msg
      let shouldInclude = true
      
      for (const transform of this.transforms) {
        // Check predicate first
        if (!transform.predicate(current)) {
          if (transform.required) {
            // Required transform rejected - skip message
            shouldInclude = false
            break
          }
          // Optional transform skipped
          continue
        }
        
        const result = transform.transform(current)
        if (result === null) {
          shouldInclude = false
          break
        }
        current = result
      }
      
      if (shouldInclude) results.push(current)
    }
    
    return results
  }
}

// Example transforms with predicates
const transforms: Transform[] = [
  {
    name: 'thinkingBlockValidator',
    predicate: (msg) => msg.parts?.some(p => p.type === 'thinking'),
    transform: validateThinkingBlocks,
    priority: 0,
    required: false
  },
  {
    name: 'keywordDetector',
    predicate: (msg) => msg.role === 'user' && msg.content?.length > 0,
    transform: detectKeywords,
    priority: 10,
    required: false
  }
]
```

**Correctness Checks**:
1. Required transforms always run when predicate matches
2. Message order preserved
3. No message loss from predicate errors
4. Guards (thinkingBlockValidator) still enforce

---

## Wave 3: Controlled Parallelization (Week 5)

### 3.1 Safe Parallel Worker Pattern

**Feature Flag**: `enableSafeParallelization`

```typescript
// src/shared/parallel-utils.ts

/**
 * Safe parallel processing with controlled concurrency
 * ONLY for independent, read-only, or isolated tasks
 * NEVER for lifecycle transitions or stateful progression
 */
async function parallelWithLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0
  let errors: Error[] = []

  async function worker() {
    while (true) {
      const current = index++
      if (current >= items.length) return
      
      try {
        results[current] = await processor(items[current])
      } catch (error) {
        errors.push(error as Error)
        results[current] = null as R
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )

  await Promise.all(workers)
  
  if (errors.length > 0) {
    throw new AggregateError(errors, `${errors.length} parallel tasks failed`)
  }
  
  return results
}

// Safe usage examples

// GOOD: Independent file reads
async function loadRuleFiles(paths: string[]) {
  return parallelWithLimit(
    paths,
    path => fileSystemCache.readFile(path),
    10
  )
}

// GOOD: Validation checks
async function validateMultiple(items: Item[]) {
  return parallelWithLimit(
    items,
    item => validateItem(item),  // Independent validation
    5
  )
}

// BAD: Lifecycle transitions (DON'T DO THIS)
// async function processTasks(tasks: Task[]) {
//   return parallelWithLimit(
//     tasks,
//     task => transitionTaskState(task),  // Stateful - sequential only!
//     5
//   )
// }
```

**Strict Rules**:
1. Only parallelize if tasks are provably independent
2. No shared mutable state between parallel tasks
3. No lifecycle transitions in parallel
4. Error handling must be robust
5. Preserve output order where required

**Correctness Checks**:
1. All parallel tasks complete or error properly
2. No race conditions in results
3. Output order preserved when required
4. Memory usage bounded
5. No state corruption

---

## Wave 4: Cleanup (Week 6)

### 4.1 Polling Consolidation

**Feature Flag**: `enableConsolidatedPolling`

```typescript
// src/shared/adaptive-poller.ts

class AdaptivePoller {
  private intervals = new Map<string, PollingConfig>()
  private timer: NodeJS.Timeout | null = null
  
  register(key: string, config: PollingConfig) {
    this.intervals.set(key, {
      ...config,
      lastRun: 0,
      inactive: false
    })
    
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), 1000)
    }
  }
  
  private tick() {
    const now = Date.now()
    
    for (const [key, config] of this.intervals) {
      const timeSinceLast = now - config.lastRun
      
      // Adaptive: slow down if inactive
      const adjustedInterval = config.inactive 
        ? config.interval * 2 
        : config.interval
      
      if (timeSinceLast >= adjustedInterval) {
        config.callback()
        config.lastRun = now
        config.inactive = this.checkInactive(key)
      }
    }
  }
  
  private checkInactive(key: string): boolean {
    // Determine if this poller is inactive
    // Override per poller
    return false
  }
}
```

**Correctness Checks**:
1. Watchdog still detects stalls on time
2. No delayed control reactions
3. Timer accuracy maintained
4. Memory bounded

---

### 4.2 Regex Pattern Cleanup

**Feature Flag**: `enableHoistedPatterns`

```typescript
// src/shared/pattern-matcher.ts

// Non-global patterns preferred (no lastIndex issues)
const KEYWORD_PATTERNS = {
  // Boolean matching - no g flag needed
  prCreated: /pr created|pull request created/i,
  taskComplete: /task completed|finished successfully/i,
  errorPattern: /error|exception|failed/i,
  
  // Only use g when you need multiple matches
  extractAllUrls: /https?:\/\/[^\s]+/g,  // g needed for extraction
}

// Safe matcher utilities
export function matchesPattern(text: string, pattern: RegExp): boolean {
  // Non-global: simple test
  if (!pattern.global) {
    return pattern.test(text)
  }
  
  // Global: reset lastIndex before test
  pattern.lastIndex = 0
  return pattern.test(text)
}

export function extractAllMatches(text: string, pattern: RegExp): string[] {
  if (!pattern.global) {
    throw new Error('Pattern must be global for extraction')
  }
  
  const matches: string[] = []
  let match: RegExpExecArray | null
  
  // Reset before extraction
  pattern.lastIndex = 0
  
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[0])
    // Prevent infinite loop on zero-width matches
    if (match.index === pattern.lastIndex) {
      pattern.lastIndex++
    }
  }
  
  return matches
}
```

**Correctness Checks**:
1. No lastIndex pollution between calls
2. Patterns match correctly
3. No infinite loops on edge cases
4. Performance improvement measurable

---

## Wave 5: Conditional (Profile-Dependent)

### 5.1 Ranked Query Cache (Only if Profiling Proves Need)

**Condition**: Implement ONLY if profiling shows repeated identical ranking queries

**Feature Flag**: `enableRankedQueryCache` (default: false)

```typescript
// src/shared/memory-db-ranking-cache.ts

class RankingCache {
  private cache = new Map<string, { result: RankedMemoryItem[]; timestamp: number }>()
  private lastWrite = 0
  private readonly TTL_MS = 2000 // Very conservative
  private enabled = false // Off by default
  
  enable() {
    this.enabled = true
  }
  
  get(key: string): RankedMemoryItem[] | undefined {
    if (!this.enabled) return undefined
    
    // Invalidate all if any write happened
    if (this.lastWrite > Date.now() - this.TTL_MS) {
      this.cache.clear()
      return undefined
    }
    
    const entry = this.cache.get(key)
    if (entry && Date.now() - entry.timestamp < this.TTL_MS) {
      return entry.result
    }
    return undefined
  }
  
  set(key: string, result: RankedMemoryItem[]) {
    if (!this.enabled) return
    this.cache.set(key, { result, timestamp: Date.now() })
  }
  
  invalidate() {
    this.lastWrite = Date.now()
    this.cache.clear()
  }
}

// Enable only if profiler shows repeated queries
if (profiler.showRepeatedRankingQueries()) {
  rankingCache.enable()
}
```

---

## Feature Flags and Rollout

### Per-Optimization Feature Flags

```typescript
// src/config/schema/plugin-config.ts
interface PerformanceOptimizations {
  // Wave 1
  enableHookEventRouter: boolean          // default: false
  enableFileSystemCache: boolean          // default: true (safe)
  enablePreparedStatements: boolean       // default: true (safe)
  
  // Wave 2
  enableSessionStateCache: boolean        // default: false
  enableMessagePredicatePipeline: boolean // default: false
  
  // Wave 3
  enableSafeParallelization: boolean      // default: false
  
  // Wave 4
  enableConsolidatedPolling: boolean     // default: false
  enableHoistedPatterns: boolean          // default: true (safe)
  
  // Wave 5 (profile-dependent)
  enableRankedQueryCache: boolean        // default: false
}
```

### Rollout Order

1. **Week 1**: Wave 0 (instrumentation only - no flags needed)
2. **Week 2**: Enable `enableFileSystemCache`, `enablePreparedStatements`
3. **Week 3**: Measure, then enable `enableHookEventRouter` if metrics good
4. **Week 4**: Measure, then enable `enableSessionStateCache`
5. **Week 5**: Measure, then enable `enableSafeParallelization`
6. **Week 6**: Enable remaining Wave 4 flags
7. **Ongoing**: Monitor metrics, only enable Wave 5 if profiling proves need

---

## Correctness Verification

### Automated Checks

```typescript
// test/correctness/optimization-safety.test.ts

describe('Hook Event Router', () => {
  test('must not suppress required guard hooks', () => {
    // Verify all required hooks run
  })
  
  test('unknown events trigger safe fallback', () => {
    // Verify safe behavior on new events
  })
})

describe('File System Cache', () => {
  test('detects file modifications immediately', async () => {
    // Write file, read, modify, verify cache invalidation
  })
  
  test('no staleness for AGENTS.md content', async () => {
    // Verify content changes reflected
  })
})

describe('Session State Cache', () => {
  test('invalidation reflects state changes immediately', () => {
    // Set cache, invalidate, verify miss
  })
  
  test('guard paths use fresh reads', () => {
    // Verify enforcement decisions not cached
  })
})

describe('Safe Parallelization', () => {
  test('preserves output order', async () => {
    // Parallel process, verify order maintained
  })
  
  test('no state corruption', async () => {
    // Parallel operations, verify state consistent
  })
})
```

### Manual Verification Checklist

- [ ] Agent completes full task without stopping
- [ ] Sandbox toggle immediate and correct
- [ ] Watchdog detects stalls within threshold
- [ ] Critique gate rejects incomplete completions
- [ ] No increase in "agent ignored context" reports
- [ ] Memory usage stable over 1 hour
- [ ] No SQLITE_BUSY errors
- [ ] File changes detected within 1 second

---

## Metrics and Monitoring

### Dashboard

```typescript
// src/shared/performance-dashboard.ts

interface PerformanceMetrics {
  // Hooks
  'hook.execution.count': number
  'hook.execution.latency_p95': number
  
  // File I/O
  'file.read.count': number
  'file.cache.hit_rate': number
  
  // Session state
  'session.api_calls_per_minute': number
  'session.cache.hit_rate': number
  
  // Database
  'db.query.latency_p95': number
  
  // Memory
  'memory.heap_usage_mb': number
  'memory.gc_frequency': number
}

// Alert thresholds
const ALERTS = {
  'hook.execution.latency_p95': { warning: 100, critical: 200 },
  'file.cache.hit_rate': { warning: 0.7, critical: 0.5 },
  'session.cache.hit_rate': { warning: 0.6, critical: 0.4 }
}
```

---

## Success Criteria

### Must Achieve (Phase 1)
- [ ] Hook overhead reduced by 20% (measured p95)
- [ ] File I/O reduced by 40% (reads per turn)
- [ ] No correctness regressions
- [ ] All tests pass

### Should Achieve (Full Plan)
- [ ] 2-4X improvement in hot paths
- [ ] 50% reduction in API calls
- [ ] Stable memory usage
- [ ] No increase in error rates

### Nice to Have (Wave 5+)
- [ ] 5X improvement in specific scenarios
- [ ] < 50ms hook overhead (p95)
- [ ] 90%+ file cache hit rate

---

## Conclusion

This plan provides:
1. **Realistic targets** (2-4X, not 10X)
2. **Safety-first approach** (explicit invalidation, version-based cache)
3. **Measurement discipline** (instrumentation before optimization)
4. **Gradual rollout** (per-optimization feature flags)
5. **Correctness verification** (automated checks + manual validation)

**Next Step**: Implement Wave 0 instrumentation, measure baselines, then begin Wave 1.
