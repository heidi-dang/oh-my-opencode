import { describe, expect, test, beforeEach } from "bun:test"
import { 
  executeHooksForEvent, 
  shouldHookRunForEvent, 
  getHooksByCategory,
  validateHookCoverage,
  HOOK_METADATA,
  EVENT_HOOK_MAP 
} from "../src/plugin/hooks/hook-event-router"
import { 
  fileSystemCache, 
  FileSystemCache 
} from "../src/shared/file-system-cache"
import { 
  sessionStateCache, 
  SessionStateCache 
} from "../src/shared/session-state-cache"
import { perfMonitor, runBenchmark } from "../src/shared/performance-monitor"
import { writeFile, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Performance Optimizations - Correctness", () => {
  describe("Hook Event Router", () => {
    const testHooks = [
      { name: "writeExistingFileGuard", execute: () => ({ stopPropagation: false }) },
      { name: "rulesInjector", execute: () => ({ modified: true }) },
      { name: "keywordDetector", execute: () => ({}) },
      { name: "autoSlashCommand", execute: () => ({}) },
      { name: "todoContinuationEnforcer", execute: () => ({}) },
    ]

    test("required hooks always run regardless of event", () => {
      const executed: string[] = []
      const hooks = [
        { 
          name: "writeExistingFileGuard", 
          execute: () => { executed.push("writeExistingFileGuard"); return {} }
        },
        { 
          name: "keywordDetector", 
          execute: () => { executed.push("keywordDetector"); return {} }
        },
      ]

      // Guard hook should run even on unknown event
      executeHooksForEvent("unknown.event", hooks, {}, {}, { featureEnabled: true })
      expect(executed).toContain("writeExistingFileGuard")
    })

    test("event-specific hooks only run on matching events", () => {
      const executed: string[] = []
      const hooks = [
        { 
          name: "keywordDetector", 
          execute: () => { executed.push("keywordDetector"); return {} }
        },
        { 
          name: "todoContinuationEnforcer", 
          execute: () => { executed.push("todoContinuationEnforcer"); return {} }
        },
      ]

      // keywordDetector runs on chat.message
      executeHooksForEvent("chat.message", hooks, {}, {}, { featureEnabled: true })
      expect(executed).toContain("keywordDetector")

      // todoContinuationEnforcer runs on session.idle
      executed.length = 0
      executeHooksForEvent("session.idle", hooks, {}, {}, { featureEnabled: true })
      expect(executed).toContain("todoContinuationEnforcer")
      expect(executed).not.toContain("keywordDetector")
    })

    test("unknown events trigger safe fallback", () => {
      const executed: string[] = []
      const hooks = [
        { 
          name: "legacyHook", 
          execute: () => { executed.push("legacyHook"); return {} }
        },
      ]

      // Unknown event should run hooks without metadata (legacy)
      executeHooksForEvent("completely.unknown", hooks, {}, {}, { featureEnabled: true })
      expect(executed).toContain("legacyHook")
    })

    test("hooks execute in priority order", () => {
      const order: number[] = []
      const hooks = [
        { 
          name: "lowPriority", 
          execute: () => { order.push(2); return {} }
        },
        { 
          name: "highPriority", 
          execute: () => { order.push(1); return {} }
        },
      ]

      // Override metadata for test
      const originalMeta = new Map(HOOK_METADATA)
      HOOK_METADATA.set("lowPriority", { priority: 100, events: ['test'], required: false, category: 'utility' })
      HOOK_METADATA.set("highPriority", { priority: 10, events: ['test'], required: false, category: 'utility' })

      executeHooksForEvent("test", hooks, {}, {}, { featureEnabled: true })
      expect(order).toEqual([1, 2])

      // Restore
      HOOK_METADATA.clear()
      for (const [k, v] of originalMeta) {
        HOOK_METADATA.set(k, v)
      }
    })

    test("stopPropagation stops hook execution", () => {
      const executed: string[] = []
      const hooks = [
        { 
          name: "first", 
          execute: () => { 
            executed.push("first")
            return { stopPropagation: true }
          }
        },
        { 
          name: "second", 
          execute: () => { executed.push("second"); return {} }
        },
      ]

      executeHooksForEvent("test", hooks, {}, {}, { featureEnabled: true })
      expect(executed).toEqual(["first"])
      expect(executed).not.toContain("second")
    })

    test("shouldHookRunForEvent returns correct values", () => {
      // Required hooks always run
      expect(shouldHookRunForEvent("writeExistingFileGuard", "any.event")).toBe(true)

      // Event-specific hooks
      expect(shouldHookRunForEvent("keywordDetector", "chat.message")).toBe(true)
      expect(shouldHookRunForEvent("keywordDetector", "session.idle")).toBe(false)
    })

    test("feature disabled falls back to running all hooks", () => {
      const executed: string[] = []
      const hooks = [
        { name: "hook1", execute: () => { executed.push("hook1"); return {} } },
        { name: "hook2", execute: () => { executed.push("hook2"); return {} } },
        { name: "hook3", execute: () => { executed.push("hook3"); return {} } },
      ]

      executeHooksForEvent("test", hooks, {}, {}, { featureEnabled: false })
      expect(executed).toEqual(["hook1", "hook2", "hook3"])
    })
  })

  describe("File System Cache", () => {
    const testDir = join(tmpdir(), "opencode-cache-test-" + Date.now())

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true })
      fileSystemCache.invalidateAll()
    })

    test("caches file content and returns on subsequent reads", async () => {
      const testFile = join(testDir, "test.txt")
      const content = "Hello, World!"
      
      await writeFile(testFile, content)
      
      // First read - cache miss
      const result1 = await fileSystemCache.readFile(testFile)
      expect(result1).toBe(content)
      
      // Second read - should be cached
      const result2 = await fileSystemCache.readFile(testFile)
      expect(result2).toBe(content)
      
      // Stats should show 1 hit, 1 miss
      const stats = fileSystemCache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })

    test("detects file modifications and invalidates cache", async () => {
      const testFile = join(testDir, "mod-test.txt")
      const content1 = "Original content"
      const content2 = "Modified content"
      
      await writeFile(testFile, content1)
      
      // First read
      const result1 = await fileSystemCache.readFile(testFile)
      expect(result1).toBe(content1)
      
      // Modify file
      await new Promise(r => setTimeout(r, 100)) // Ensure mtime changes
      await writeFile(testFile, content2)
      
      // Second read - should detect change
      const result2 = await fileSystemCache.readFile(testFile)
      expect(result2).toBe(content2)
    })

    test("batch read returns all files", async () => {
      const files = ["file1.txt", "file2.txt", "file3.txt"]
      const paths = files.map(f => join(testDir, f))
      
      // Create files
      for (let i = 0; i < files.length; i++) {
        await writeFile(paths[i], `Content ${i + 1}`)
      }
      
      // Batch read
      const results = await fileSystemCache.readFiles(paths)
      
      expect(results.get(paths[0])).toBe("Content 1")
      expect(results.get(paths[1])).toBe("Content 2")
      expect(results.get(paths[2])).toBe("Content 3")
    })

    test("respects max cache size with LRU eviction", async () => {
      const cache = new FileSystemCache()
      
      // Create more files than max cache size
      const files: string[] = []
      for (let i = 0; i < 110; i++) {
        const file = join(testDir, `lru-${i}.txt`)
        await writeFile(file, `Content ${i}`)
        files.push(file)
      }
      
      // Read all files
      for (const file of files) {
        await cache.readFile(file)
      }
      
      // Should be at or under max size
      const stats = cache.getStats()
      expect(stats.size).toBeLessThanOrEqual(100)
    })

    test("cleanup removes expired entries", async () => {
      const testFile = join(testDir, "expired.txt")
      await writeFile(testFile, "content")
      
      // Read to cache
      await fileSystemCache.readFile(testFile)
      
      // Manually expire by manipulating timestamp
      const entry = (fileSystemCache as any).cache.get(testFile)
      if (entry) {
        entry.timestamp = Date.now() - 10 * 60 * 1000 // 10 minutes ago
      }
      
      // Cleanup
      fileSystemCache.cleanup()
      
      // Should be evicted
      const stats = fileSystemCache.getStats()
      expect(stats.evictions).toBeGreaterThan(0)
    })
  })

  describe("Session State Cache", () => {
    let cache: SessionStateCache

    beforeEach(() => {
      cache = new SessionStateCache()
    })

    test("caches and retrieves session state", () => {
      const sessionID = "test-session-1"
      const state = {
        modelID: "claude-3-opus",
        status: "running",
        agent: "sisyphus",
        version: 1
      }

      cache.set(sessionID, state)
      
      // Get without version - uses TTL
      const cached = cache.get(sessionID)
      expect(cached).toBeDefined()
      expect(cached?.modelID).toBe("claude-3-opus")
    })

    test("version-based validation returns match", () => {
      const sessionID = "test-session-2"
      const state = {
        modelID: "claude-3-opus",
        status: "running",
        version: 5
      }

      cache.set(sessionID, state)
      
      // Get with correct version
      const cached = cache.get(sessionID, 5)
      expect(cached).toBeDefined()
      
      // Get with wrong version - should miss
      const wrongVersion = cache.get(sessionID, 4)
      expect(wrongVersion).toBeUndefined()
    })

    test("invalidation removes entry immediately", () => {
      const sessionID = "test-session-3"
      const state = { modelID: "claude-3", version: 1 }

      cache.set(sessionID, state)
      expect(cache.get(sessionID)).toBeDefined()
      
      // Invalidate
      cache.invalidate(sessionID)
      
      // Should be gone
      expect(cache.get(sessionID)).toBeUndefined()
    })

    test("event-driven invalidation workflow", () => {
      const sessionID = "test-session-4"
      
      // Simulate: session.status event triggers invalidation
      cache.set(sessionID, { modelID: "model-a", version: 1 })
      
      // Event received
      cache.invalidate(sessionID)
      
      // Next read should miss
      expect(cache.get(sessionID)).toBeUndefined()
      
      // Fresh state stored
      cache.set(sessionID, { modelID: "model-b", version: 2 })
      expect(cache.get(sessionID)?.modelID).toBe("model-b")
    })

    test("stats tracking", () => {
      const sessionID = "test-session-5"
      
      // Miss
      cache.get(sessionID)
      
      // Set and hit
      cache.set(sessionID, { modelID: "test", version: 1 })
      cache.get(sessionID)
      
      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    test("cleanup removes expired entries", () => {
      const sessionID = "test-session-6"
      
      cache.set(sessionID, { modelID: "test", version: 1 })
      
      // Manually expire
      const entry = (cache as any).cache.get(sessionID)
      if (entry) {
        entry.updatedAt = Date.now() - 20 * 1000 // 20 seconds ago (TTL is 5s)
      }
      
      cache.cleanup()
      
      const stats = cache.getStats()
      expect(stats.evictions).toBeGreaterThan(0)
    })
  })

  describe("Performance Monitor", () => {
    beforeEach(() => {
      perfMonitor.reset()
    })

    test("measures sync function execution", () => {
      const result = perfMonitor.measure("test.sync", () => {
        // Simulate work
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      })
      
      expect(result).toBe(499500) // sum of 0..999
      
      const metric = perfMonitor.getMetric("test.sync")
      expect(metric?.count).toBe(1)
      expect(metric?.totalTime).toBeGreaterThan(0)
    })

    test("measures async function execution", async () => {
      const result = await perfMonitor.measureAsync("test.async", async () => {
        await new Promise(r => setTimeout(r, 10))
        return "done"
      })
      
      expect(result).toBe("done")
      
      const metric = perfMonitor.getMetric("test.async")
      expect(metric?.count).toBe(1)
    })

    test("calculates percentiles correctly", () => {
      // Simulate multiple measurements
      for (let i = 0; i < 100; i++) {
        perfMonitor.measure("test.percentile", () => {
          // Varying execution times
          for (let j = 0; j < i * 10; j++) {
            Math.sqrt(j)
          }
        })
      }
      
      const report = perfMonitor.report()
      const metric = report["test.percentile"]
      
      expect(metric.p50).toBeGreaterThan(0)
      expect(metric.p95).toBeGreaterThanOrEqual(metric.p50)
      expect(metric.p99).toBeGreaterThanOrEqual(metric.p95)
    })

    test("benchmark harness runs correctly", async () => {
      const result = await runBenchmark(
        "test.benchmark",
        async () => {
          await new Promise(r => setTimeout(r, 1))
        },
        {
          warmup: 5,
          iterations: 20,
          discardOutliers: 0.1
        }
      )
      
      expect(result.name).toBe("test.benchmark")
      expect(result.p50).toBeGreaterThan(0)
      expect(result.p95).toBeGreaterThanOrEqual(result.p50)
      expect(result.min).toBeGreaterThanOrEqual(0)
      expect(result.max).toBeGreaterThanOrEqual(result.min)
    })
  })

  describe("Integration - Hook Filtering Performance", () => {
    test("filtered execution reduces hook count", () => {
      const hooks = [
        { name: "writeExistingFileGuard", execute: () => ({}) },
        { name: "rulesInjector", execute: () => ({}) },
        { name: "keywordDetector", execute: () => ({}) },
        { name: "autoSlashCommand", execute: () => ({}) },
        { name: "todoContinuationEnforcer", execute: () => ({}) },
      ]
      
      let executedCount = 0
      const countingHooks = hooks.map(h => ({
        ...h,
        execute: () => {
          executedCount++
          return {}
        }
      }))

      // On session.idle, only specific hooks should run
      executeHooksForEvent("session.idle", countingHooks, {}, {}, { featureEnabled: true })
      
      // Should be fewer than all hooks
      expect(executedCount).toBeLessThan(hooks.length)
    })

    test("unfiltered execution runs all hooks", () => {
      const hooks = [
        { name: "hook1", execute: () => ({}) },
        { name: "hook2", execute: () => ({}) },
        { name: "hook3", execute: () => ({}) },
      ]
      
      let executedCount = 0
      const countingHooks = hooks.map(h => ({
        ...h,
        execute: () => {
          executedCount++
          return {}
        }
      }))

      // Feature disabled - runs all
      executeHooksForEvent("any.event", countingHooks, {}, {}, { featureEnabled: false })
      
      expect(executedCount).toBe(hooks.length)
    })
  })
})

// Performance benchmarks
describe("Performance Benchmarks", () => {
  test("hook execution baseline", async () => {
    const hooks = Array.from({ length: 20 }, (_, i) => ({
      name: `hook-${i}`,
      execute: () => {
        // Simulate light work
        let sum = 0
        for (let j = 0; j < 100; j++) sum += j
        return { sum }
      }
    }))

    const result = await runBenchmark(
      "hook.execution.baseline",
      async () => {
        executeHooksForEvent("test.event", hooks, {}, {}, { featureEnabled: false })
      },
      { warmup: 10, iterations: 100, discardOutliers: 0.05 }
    )

    console.log("Hook execution baseline:", result)
    expect(result.p50).toBeLessThan(10) // Should be very fast
  })

  test("file cache performance", async () => {
    const testDir = join(tmpdir(), "perf-test-" + Date.now())
    await mkdir(testDir, { recursive: true })
    
    // Create test file
    const testFile = join(testDir, "perf.txt")
    await writeFile(testFile, "x".repeat(10000))
    
    const cache = new FileSystemCache()

    // First read (miss)
    const missResult = await runBenchmark(
      "file.read.miss",
      async () => {
        cache.invalidate(testFile)
        return cache.readFile(testFile)
      },
      { warmup: 0, iterations: 10, discardOutliers: 0 }
    )

    // Second read (hit)
    const hitResult = await runBenchmark(
      "file.read.hit",
      async () => await cache.readFile(testFile),
      { warmup: 0, iterations: 100, discardOutliers: 0.1 }
    )

    console.log("File cache - Miss:", missResult.p50, "ms, Hit:", hitResult.p50, "ms")
    
    // Hit should be much faster than miss
    expect(hitResult.p50).toBeLessThan(missResult.p50 / 2)

    // Cleanup
    await rm(testDir, { recursive: true })
  })
})
