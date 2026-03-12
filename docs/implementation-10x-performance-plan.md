# Performance Optimization Implementation Plan: Real 10X Improvement

**Status**: Draft Plan  
**Target**: 10X overall performance improvement through realistic, production-safe optimizations  
**Phased Implementation**: 4 phases over 4-6 weeks

---

## Executive Summary

This plan addresses performance bottlenecks identified through code analysis and prioritizes **high-confidence optimizations** that deliver real gains without introducing stale-state bugs or race conditions.

### Realistic Performance Targets

| Phase | Optimizations | Expected Improvement | Cumulative |
|-------|--------------|---------------------|------------|
| Phase 1 | Hook filtering, Session cache, File I/O cache, DB optimization | **30-50%** | 30-50% |
| Phase 2 | Message transform pipeline | **15-25%** | 45-75% |
| Phase 3 | Safe parallelization, Ranked query cache | **10-20%** | 55-95% |
| Phase 4 | Polling consolidation, Regex cleanup | **5-15%** | 60-110% |

**Realistic Overall**: **2-4X improvement** in hot paths, with potential for **10X** in specific scenarios (e.g., rule-heavy sessions, repeated file reads).

---

## Phase 1: High-Confidence Wins (Week 1-2)

### 1.1 Hook Event Filtering

**Problem**: All 46 hooks execute on every event, even when irrelevant.

**Solution**: Event-to-hook routing map with priority ordering.

**Implementation**:
```typescript
// src/plugin/hooks/hook-event-router.ts
const EVENT_HOOK_MAP = new Map([
  ["session.idle", new Set([
    "contextWindowMonitor", 
    "preemptiveCompaction", 
    "todoContinuationEnforcer"
  ])],
  ["chat.message", new Set([
    "keywordDetector", 
    "autoSlashCommand"
  ])],
  // ... other events
])

export function executeRelevantHooks(
  event: string, 
  hooks: Hook[], 
  input: unknown, 
  output: unknown
) {
  const relevant = EVENT_HOOK_MAP.get(event)
  if (!relevant) return
  
  const toExecute = hooks
    .filter(h => relevant.has(h.name))
    .sort((a, b) => a.priority - b.priority)
  
  for (const hook of toExecute) {
    const result = hook.execute(input, output)
    if (result?.stopPropagation) break
  }
}
```

**Realistic Gain**: 30-50% reduction in hook execution overhead  
**Risk**: Low - explicit mapping, easy to verify  
**Testing**: Compare hook execution count before/after

---

### 1.2 Session State Cache

**Problem**: `BackgroundManager`, `RunStateWatchdog`, hooks repeatedly fetch session state via API.

**Solution**: Two-tier cache with short TTL and event-driven invalidation.

**Implementation**:
```typescript
// src/shared/session-state-cache.ts (already created)
class SessionStateCache {
  private l1 = new Map() // 5s TTL
  private l2 = new Map() // 10s TTL
  private invalidations = new Map()
  
  get(sessionID: string) {
    // Check L1 first
    // Check L2, promote to L1 if valid
    // Return undefined if invalidated
  }
  
  set(sessionID: string, state: SessionState) {
    // Write to both tiers
  }
  
  invalidate(sessionID: string) {
    // Called on session.update events
    // Immediate L1 removal
    // L2 marked for lazy eviction
  }
}
```

**Realistic Gain**: 40-60% reduction in API calls  
**Risk**: Low - short TTL prevents staleness  
**Testing**: Monitor cache hit rates, verify no stale data

---

### 1.3 File I/O Cache for Rules/Skills

**Problem**: `rules-injector`, `skill-loader` re-read same files every turn.

**Solution**: Cache by path + mtime + size.

**Implementation**:
```typescript
// src/shared/file-system-cache.ts (already created)
class FileSystemCache {
  private cache = new Map<string, FileCacheEntry>()
  private readonly MAX_SIZE = 100
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes
  
  async readFile(path: string): Promise<string | null> {
    const stats = await stat(path)
    const cached = this.cache.get(path)
    
    // Validate: mtime + size + TTL
    if (cached && 
        cached.mtime === stats.mtime.getTime() &&
        cached.size === stats.size &&
        Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.content
    }
    
    // Cache miss: read and store
    const content = await readFile(path, 'utf-8')
    this.cache.set(path, { content, mtime: stats.mtime.getTime(), size: stats.size, timestamp: Date.now() })
    
    // LRU eviction if over limit
    if (this.cache.size > this.MAX_SIZE) this.evictLRU()
    
    return content
  }
}
```

**Realistic Gain**: 50-70% reduction in file I/O  
**Risk**: Low - mtime validation prevents staleness  
**Testing**: Monitor cache hit rates, verify file changes detected

---

### 1.4 Database Prepared Statements

**Problem**: ContextCollector recompiles SQL on every operation.

**Solution**: Prepared statement reuse + transaction grouping (no delayed batching).

**Implementation**:
```typescript
// src/features/context-injector/optimized-db.ts (already created)
class OptimizedContextDB {
  private statements: {
    insert?: ReturnType<Database["prepare"]>
    selectBySession?: ReturnType<Database["prepare"]>
    // ...
  } = {}
  
  constructor(db: Database) {
    this.initializeStatements()
  }
  
  private initializeStatements() {
    this.statements.insert = this.db.prepare(`
      INSERT OR REPLACE INTO session_contexts 
      (id, session_id, source, content, priority, persistent, registration_order, metadata)
      VALUES ($id, $session_id, $source, $content, $priority, $persistent, 
              (SELECT COALESCE(MAX(registration_order), 0) + 1 FROM session_contexts WHERE session_id = $session_id), $metadata)
    `)
    // ... other statements
  }
  
  register(entry: ContextRegistration) {
    // Use prepared statement
    this.statements.insert?.run({...})
  }
  
  registerBatch(entries: ContextRegistration[]) {
    // Use transaction for multi-write flows (immediate, not delayed)
    const insert = this.db.transaction((items) => {
      for (const item of items) this.register(item)
    })
    insert(entries)
  }
}
```

**Realistic Gain**: 20-40% reduction in DB overhead  
**Risk**: Low - prepared statements are standard best practice  
**Testing**: Profile DB operations before/after

---

## Phase 2: Message Transform Pipeline (Week 3)

### 2.1 Predicate-Based Message Transforms

**Problem**: All transforms apply to every message, even when not applicable.

**Solution**: Predicate-based filtering with early exit.

**Implementation**:
```typescript
// src/plugin/handlers/optimized-messages-transform.ts
interface Transform {
  name: string
  predicate: (msg: Message) => boolean  // Skip if false
  transform: (msg: Message) => Message | null  // null = remove message
  priority: number
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
        // Skip transforms that don't apply
        if (!transform.predicate(current)) continue
        
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
```

**Realistic Gain**: 15-25% reduction in transform overhead  
**Risk**: Medium - need to ensure predicates are correct  
**Testing**: Validate all transforms still apply correctly

---

## Phase 3: Controlled Parallelization (Week 4)

### 3.1 Safe Parallel Processing

**Problem**: Sequential await in loops for independent operations.

**Solution**: Controlled parallelization with concurrency limits.

**Implementation**:
```typescript
// src/shared/async-utils.ts
async function parallelWithLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  const executing: Promise<void>[] = []
  
  for (let i = 0; i < items.length; i++) {
    const promise = (async () => {
      try {
        results[i] = await processor(items[i])
      } catch (error) {
        results[i] = null as R  // or handle error appropriately
      }
    })()
    
    executing.push(promise)
    
    if (executing.length >= concurrency) {
      await Promise.race(executing)
      // Remove completed promises
      for (let j = executing.length - 1; j >= 0; j--) {
        if (await Promise.race([executing[j], Promise.resolve('pending')]) !== 'pending') {
          executing.splice(j, 1)
        }
      }
    }
  }
  
  await Promise.all(executing)
  return results
}

// Safe usage - only for independent operations
// Good: file reads, validation checks
// Bad: lifecycle transitions, stateful progression
```

**Realistic Gain**: 10-20% for parallelizable operations  
**Risk**: Medium - must only parallelize independent operations  
**Testing**: Verify no race conditions, proper error handling

---

### 3.2 Ranked Query Cache (Conservative)

**Problem**: MemoryDB rankedQuery rescoring on every call.

**Solution**: Very short-lived cache with aggressive invalidation.

**Implementation**:
```typescript
// src/shared/memory-db-ranking-cache.ts
class RankingCache {
  private cache = new Map<string, { result: RankedMemoryItem[]; timestamp: number }>()
  private readonly TTL_MS = 2000 // 2 seconds only
  private lastWrite = 0
  
  get(key: string): RankedMemoryItem[] | undefined {
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
    this.cache.set(key, { result, timestamp: Date.now() })
  }
  
  invalidate() {
    this.lastWrite = Date.now()
    this.cache.clear()
  }
}
```

**Realistic Gain**: 10-20% for repeated queries  
**Risk**: Medium - memory must not be stale  
**Testing**: Very short TTL prevents staleness issues

---

## Phase 4: Cleanup (Week 5-6)

### 4.1 Polling Consolidation

**Problem**: Multiple polling intervals (3s background, 10s watchdog).

**Solution**: Unified polling with adaptive intervals.

**Implementation**:
```typescript
// src/shared/adaptive-poller.ts
class AdaptivePoller {
  private intervals = new Map<string, PollingConfig>()
  private timer: NodeJS.Timeout | null = null
  
  register(key: string, config: PollingConfig) {
    this.intervals.set(key, config)
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), 1000) // 1s base tick
    }
  }
  
  private tick() {
    const now = Date.now()
    for (const [key, config] of this.intervals) {
      const timeSinceLast = now - config.lastRun
      const adjustedInterval = config.inactive 
        ? config.interval * 2  // Slow down if inactive
        : config.interval
      
      if (timeSinceLast >= adjustedInterval) {
        config.callback()
        config.lastRun = now
        config.inactive = this.checkInactive(key)
      }
    }
  }
}
```

**Realistic Gain**: 5-15% background overhead reduction  
**Risk**: Low - cleanup only  
**Testing**: Verify all pollers still work correctly

---

### 4.2 Regex Pattern Cleanup

**Problem**: Some regex patterns recompiled on every use.

**Solution**: Pre-compile hot patterns (not a major win, but good hygiene).

**Implementation**:
```typescript
// src/shared/pattern-matcher.ts
class PatternMatcher {
  // Pre-compile patterns used in hot paths
  private static readonly KEYWORD_PATTERNS = {
    prCreated: /pr created|pull request created/gi,
    taskComplete: /task completed|finished successfully/gi,
    // ... other hot patterns
  }
  
  static matchKeywords(text: string): string[] {
    const matches: string[] = []
    const lowerText = text.toLowerCase()
    
    for (const [name, pattern] of Object.entries(this.KEYWORD_PATTERNS)) {
      if (pattern.test(lowerText)) {
        matches.push(name)
        pattern.lastIndex = 0  // Reset for next use
      }
    }
    
    return matches
  }
}
```

**Realistic Gain**: 5-10% in hot paths  
**Risk**: Low - code hygiene improvement  
**Testing**: Verify patterns still match correctly

---

## Implementation Order

### Week 1
1. **Hook Event Filtering** - High impact, low risk
2. **File I/O Cache** - High impact, low risk

### Week 2
3. **Session State Cache** - High impact, need careful invalidation
4. **DB Prepared Statements** - Medium impact, low risk

### Week 3
5. **Message Transform Pipeline** - Medium impact, need predicate testing

### Week 4
6. **Safe Parallelization** - Medium impact, careful with scope
7. **Ranking Cache** - Low-medium impact, very conservative TTL

### Week 5-6
8. **Polling Consolidation** - Low impact, cleanup
9. **Regex Cleanup** - Low impact, cleanup

---

## Testing Strategy

### Before Each Phase
- Baseline performance measurements
- Hook execution counts
- File I/O operation counts
- API call frequencies
- DB operation timings

### During Implementation
- Unit tests for each optimization
- Integration tests for interactions
- Memory leak detection
- Race condition testing

### After Each Phase
- A/B performance comparison
- Regression testing
- Stale data validation
- Error rate monitoring

---

## Risk Mitigation

### High-Risk Areas
1. **Caching**: Always use short TTL + explicit invalidation
2. **Parallelization**: Only parallelize provably independent operations
3. **Batching**: No delayed batching - immediate transactions only

### Monitoring
1. Cache hit/miss rates
2. Stale data detection
3. Error rate changes
4. Memory usage
5. Agent behavior changes

### Rollback Plan
Each optimization is isolated and can be disabled via feature flags:
```typescript
if (config.experimental?.enableHookFiltering) {
  useOptimizedHookRegistry()
} else {
  useOriginalHookSystem()
}
```

---

## Success Metrics

### Primary
- Agent response time (p50, p95, p99)
- Hook execution overhead per message
- File I/O operations per turn
- API calls per session

### Secondary
- Memory usage
- CPU utilization
- Error rates
- User-perceived lag

### Realistic Targets
- **2-4X improvement** in hot paths
- **30-50% reduction** in hook overhead
- **50-70% reduction** in file I/O
- **40-60% reduction** in redundant API calls

---

## Conclusion

This plan prioritizes **realistic, production-safe optimizations** over speculative gains. The focus is on:

1. **High-confidence wins** first (hook filtering, caching, file I/O)
2. **Careful implementation** with proper invalidation and short TTLs
3. **No race conditions** or stale-state bugs
4. **Measurable improvements** with proper A/B testing

The goal is **2-4X real improvement**, with potential for **10X** in specific scenarios, while maintaining system stability and correctness.
