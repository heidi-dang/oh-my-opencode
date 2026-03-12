# Performance Optimization Engineering Review

**Date**: March 12, 2026  
**Status**: Under Review  
**Scope**: Guard gating functions and hot-path optimizations

---

## 1. KEEP (Safe to Implement)

### 1.1 Set Lookups for Fixed Lists

**Rationale**: O(1) vs O(n), zero risk, clean code improvement.

**Applicable to**:
- Critique gate tool allow/block lists
- Command keyword tables  
- Known hook names
- Tool name checks

**Example**:
```typescript
// Before
const COMPLETE_TASK_TOOLS = ["complete_task", "task_update"]
if (COMPLETE_TASK_TOOLS.includes(input.tool)) { ... }

// After
const COMPLETE_TASK_TOOLS_SET = new Set(["complete_task", "task_update"])
if (COMPLETE_TASK_TOOLS_SET.has(input.tool)) { ... }
```

**Implementation Priority**: High  
**Risk**: None  
**Expected Gain**: 10-20% for lookup-heavy paths

---

### 1.2 Hoisted Pattern Objects (Non-Global Regex)

**Rationale**: Reduces repeated allocations in hot paths.

**Constraints**:
- Only for truly hot-path functions
- Must use non-global patterns OR reset lastIndex
- Must have measurable impact

**Safe Pattern**:
```typescript
// Safe: non-global regex
const SUSPICIOUS_PATTERNS = [
  /pr created|pull request created/i,
  /task completed|finished successfully/i,
]

// OR: global with reset
const GLOBAL_PATTERN = /something/g
function check(text: string): boolean {
  GLOBAL_PATTERN.lastIndex = 0
  return GLOBAL_PATTERN.test(text)
}
```

**Implementation Priority**: Medium  
**Risk**: Low (if non-global)  
**Expected Gain**: 5-15% in hot paths

---

### 1.3 Caching Read-Only Derived Context

**Rationale**: Safe because it's derived data, not enforcement state.

**Safe Targets**:
- Repository examples in language intelligence (path + mtime based)
- AGENTS.md / README.md content (file hash based)
- Skill YAML frontmatter (file hash based)
- Config file parsing (mtime based)

**Requirements**:
```typescript
interface CacheKey {
  path: string
  mtime: number
  size: number
}

// TTL: 5 minutes max
// Invalidation: immediate on mtime change
```

**Implementation Priority**: High  
**Risk**: Low  
**Expected Gain**: 50-70% reduction in file I/O

---

### 1.4 Reducing Repeated Object Allocations

**Rationale**: GC pressure reduction in hot loops.

**Examples**:
- Reuse temporary arrays
- Pre-allocate result collections
- Avoid creating throwaway objects in loops

**Implementation Priority**: Medium  
**Risk**: None  
**Expected Gain**: 10-20% in allocation-heavy paths

---

## 2. REJECT (Too Risky or Wrong Trade-off)

### 2.1 Caching Guard State with TTL

**Rejection Reason**: Guard functions decide whether agent can act. Stale cache = wrong decision.

**Specific Risks**:
- False allows (security/quality issue)
- False blocks (user frustration)
- Delayed enforcement (race conditions)
- Hard-to-reproduce behavior

**Guard State That Must Stay Fresh**:
- Sandbox enable/disable state
- Session enforcement state
- Critique eligibility
- Lifecycle phase
- Watchdog stall detection

**Verdict**: Reject all TTL-based caching for enforcement decisions.

---

### 2.2 Batch Abort Operations

**Rejection Reason**: Changes semantics of control paths.

**Problem**:
- Abort/stop/watchdog paths are latency-sensitive
- Batching improves throughput on paper
- Makes actual stopping behavior worse

**Verdict**: Reject unless profiling proves abort path is overloaded.

---

### 2.3 Debounced Notifications as Core Perf Win

**Rejection Reason**: This is UX cleanup, not runtime acceleration.

**Reality**: Debouncing reduces notification spam but doesn't meaningfully speed up agent execution.

**Verdict**: Accept as UX improvement, not performance optimization.

---

### 2.4 Inflated "100-200% Faster" Claims

**Rejection Reason**: Numbers lack evidence.

**Missing**:
- Benchmark harness
- Hardware baseline
- Warm/cold cache distinction
- Sample count
- p50/p95/p99 timing
- GC isolation
- Correctness verification under load

**Verdict**: Reject all unmeasured claims. Replace with measured numbers.

---

## 3. REVISE (Needs Stricter Design)

### 3.1 Model ID Cache in Watchdog

**Condition**: Only acceptable if:
1. Model ID lookup is proven expensive
2. Model ID changes are rare
3. Invalidation is explicit (not TTL-based)
4. Cache invalidated on session state change events

**Revised Design**:
```typescript
class ModelIDCache {
  private cache = new Map<string, string>()
  
  get(sessionID: string): string | undefined {
    return this.cache.get(sessionID)
  }
  
  set(sessionID: string, modelID: string): void {
    this.cache.set(sessionID, modelID)
  }
  
  // Explicit invalidation only - no TTL
  invalidate(sessionID: string): void {
    this.cache.delete(sessionID)
  }
  
  invalidateAll(): void {
    this.cache.clear()
  }
}

// Invalidation on session events
on("session.status", (event) => {
  modelCache.invalidate(event.sessionID)
})
```

**Implementation Priority**: Medium (with explicit invalidation)  
**Risk**: Medium  
**Expected Gain**: 20-40% if lookup is expensive

---

### 3.2 Database Prepared Statements

**Condition**: Already good, just ensure:
1. No delayed batching (immediate transactions only)
2. Proper statement cleanup on close
3. Transaction grouping for known multi-write flows

**Revised Design**:
```typescript
class OptimizedContextDB {
  private statements: {
    insert?: ReturnType<Database["prepare"]>
    // ... others
  } = {}
  
  constructor(db: Database) {
    this.initializeStatements()
  }
  
  register(entry: ContextRegistration): void {
    // Use prepared statement
    this.statements.insert?.run({...})
  }
  
  registerBatch(entries: ContextRegistration[]): void {
    // Immediate transaction, NOT delayed batching
    const insert = this.db.transaction((items) => {
      for (const item of items) this.register(item)
    })
    insert(entries)
  }
  
  close(): void {
    // Cleanup
    for (const stmt of Object.values(this.statements)) {
      stmt?.finalize()
    }
  }
}
```

**Implementation Priority**: High  
**Risk**: Low  
**Expected Gain**: 20-40% reduction in DB overhead

---

### 3.3 Hook Event Filtering

**Condition**: Good concept, needs careful mapping.

**Revised Design**:
```typescript
// Conservative mapping - only exclude clearly irrelevant hooks
const EVENT_HOOK_MAP = new Map<string, Set<HookName>>([
  ["session.idle", new Set([
    "contextWindowMonitor",
    "preemptiveCompaction", 
    "todoContinuationEnforcer",
    // ... only hooks that MUST run on idle
  ])],
  // ... other events
])

// Default: if event not in map, run all hooks (safe fallback)
function executeHooks(event: string, hooks: Hook[], input: unknown, output: unknown) {
  const relevant = EVENT_HOOK_MAP.get(event)
  if (!relevant) {
    // Unknown event - run all hooks (safe)
    for (const hook of hooks) hook.execute(input, output)
    return
  }
  
  // Known event - only run relevant hooks
  const toRun = hooks.filter(h => relevant.has(h.name))
  for (const hook of toRun) {
    hook.execute(input, output)
  }
}
```

**Implementation Priority**: High  
**Risk**: Medium (need correct mapping)  
**Expected Gain**: 30-50% reduction in hook overhead

---

## 4. BENCHMARK REQUIREMENTS

Before claiming any optimization is successful, provide:

### 4.1 Hardware Baseline
- CPU model
- RAM
- Disk type (SSD/HDD)

### 4.2 Runtime Environment
- Node.js / Bun version
- Operating system
- Default ulimit / file descriptor limits

### 4.3 Test Methodology
- Warmup iterations: 100
- Measured iterations: 1000
- Discard outliers: top/bottom 5%
- GC isolation: run GC before measurements

### 4.4 Metrics
- p50 (median)
- p95
- p99
- Standard deviation
- Memory usage before/after

### 4.5 Correctness Verification
- All existing tests pass
- New tests for cache invalidation
- Stress test: 10k operations
- Staleness test: verify no false allows/blocks

### 4.6 Report Format
```
Optimization: [Name]
Baseline: 100ms (p50), 500ms (p95)
Optimized: 50ms (p50), 250ms (p95)
Improvement: 50% latency reduction, 2.0x throughput
Correctness: All tests pass, no stale data detected
Risk: Low/Medium/High
Recommendation: Merge/Reject/Revise
```

---

## 5. ROLLOUT ORDER

### Phase 1: Zero-Risk (Week 1)
1. **Set Lookups** - Merge immediately
2. **Non-Global Regex Hoisting** - Merge with tests
3. **Object Allocation Reduction** - Code review only

### Phase 2: Low-Risk (Week 2-3)
4. **File I/O Caching** - With mtime validation
5. **DB Prepared Statements** - With transaction grouping
6. **Derived Context Caching** - With hash-based invalidation

### Phase 3: Medium-Risk (Week 4-5)
7. **Hook Event Filtering** - With comprehensive mapping tests
8. **Model ID Cache** - With explicit invalidation only

### Phase 4: Measurement (Week 6)
9. **Benchmark All Optimizations**
10. **A/B Test in Production**
11. **Rollback Plan Verification**

---

## 6. CORRECTNESS GUARANTEES REQUIRED

For each optimization, prove:

### 6.1 No Stale Allow/Block
- Guard decisions use fresh state
- No TTL-based caching for enforcement
- Immediate invalidation on state change

### 6.2 No Delayed Sandbox Toggle
- Sandbox state changes visible immediately
- No batching for control operations
- Direct state propagation

### 6.3 No Missed Watchdog Stall
- Stall detection runs on schedule
- No delayed polling
- Timer accuracy maintained

### 6.4 No False Positives/Negatives
- Pattern matching unchanged
- Only implementation optimized, not logic
- Full test suite passes

---

## 7. WHAT THIS DOES AND DOES NOT FIX

### DOES Improve
- Hook execution overhead
- File I/O latency
- Database query time
- Memory allocation pressure
- Repeated computation

### DOES NOT Fix
- Random stop-after-prompt
- No continuation after tool completion
- State-machine freezes
- Watchdog-triggered halts
- Loop-guard shutdowns
- Lifecycle deadlocks

**Important**: These optimizations reduce lag but don't address core "agent stops" issues which are likely lifecycle/state-machine problems.

---

## 8. UNRESOLVED ISSUES

### 8.1 Merge Conflict Markers
Files contain conflict markers that must be resolved before merging.

### 8.2 Type Errors
`optimized-hook-registry.ts` has unresolved type errors with HookName type.

### 8.3 Missing Tests
No benchmark harness exists yet. No correctness tests for cache invalidation.

---

## 9. FINAL VERDICT

### Safe to Merge Immediately
- Set lookups for fixed lists
- Non-global regex hoisting
- Allocation reduction in hot loops

### Safe with Tests
- File I/O caching (mtime-based)
- DB prepared statements
- Derived context caching

### Requires Careful Design
- Hook event filtering (needs correct mapping)
- Model ID cache (needs explicit invalidation)

### Reject
- TTL-based guard state caching
- Batch abort operations
- Debounced notifications as perf win
- All unmeasured "100-200% faster" claims

---

## 10. NEXT STEPS

1. Resolve merge conflicts
2. Fix type errors in hook registry
3. Implement Set lookup optimizations (immediate)
4. Build benchmark harness
5. Measure actual gains
6. Create feature flags for gradual rollout
7. A/B test in production
8. Document actual (not claimed) improvements

---

**Document Status**: Draft - Awaiting measurement data before final approval
