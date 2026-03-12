/**
 * Performance Benchmark Suite
 * 
 * Comprehensive benchmarks for all Waves 0-4 optimizations.
 * Run with: bun test test/performance-benchmarks.ts
 */

import { describe, test, expect } from "bun:test"
import { runBenchmark, perfMonitor } from "../src/shared/performance-monitor"
import { fileSystemCache, FileSystemCache } from "../src/shared/file-system-cache"
import { sessionStateCache, SessionStateCache } from "../src/shared/session-state-cache"
import { executeHooksForEvent } from "../src/plugin/hooks/hook-event-router"
import { parallelWithLimit } from "../src/shared/parallel-utils"
import { mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Performance Benchmarks - Wave 1", () => {
  
  test("Hook Event Router - Baseline vs Optimized", async () => {
    // Create 20 test hooks
    const hooks = Array.from({ length: 20 }, (_, i) => ({
      name: `hook-${i}`,
      execute: () => {
        // Simulate work
        let sum = 0
        for (let j = 0; j < 1000; j++) sum += j
        return { sum }
      }
    }))

    // Baseline: run all hooks
    const baseline = await runBenchmark(
      "hook.baseline",
      async () => {
        for (const hook of hooks) {
          hook.execute()
        }
      },
      { warmup: 10, iterations: 100, discardOutliers: 0.05 }
    )

    // Optimized: run only relevant hooks (feature disabled for comparison)
    const optimized = await runBenchmark(
      "hook.optimized",
      async () => {
        executeHooksForEvent("chat.message", hooks, {}, {}, { featureEnabled: false })
      },
      { warmup: 10, iterations: 100, discardOutliers: 0.05 }
    )

    console.log("\n=== Hook Event Router ===")
    console.log(`Baseline: ${baseline.p50.toFixed(2)}ms (p50), ${baseline.p95.toFixed(2)}ms (p95)`)
    console.log(`Optimized: ${optimized.p50.toFixed(2)}ms (p50), ${optimized.p95.toFixed(2)}ms (p95)`)
    console.log(`Improvement: ${((baseline.p50 - optimized.p50) / baseline.p50 * 100).toFixed(1)}%`)
    
    // Should be similar when feature disabled (just function call overhead)
    expect(optimized.p50).toBeLessThan(baseline.p50 * 1.5) // Within 50%
  })

  test("File System Cache - Miss vs Hit", async () => {
    const testDir = join(tmpdir(), "perf-bench-" + Date.now())
    await mkdir(testDir, { recursive: true })
    
    // Create test files
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: join(testDir, `file-${i}.txt`),
      content: "x".repeat(10000)
    }))
    
    for (const f of files) {
      await writeFile(f.path, f.content)
    }

    const cache = new FileSystemCache()

    // Cold read (miss)
    const missBench = await runBenchmark(
      "file.miss",
      async () => {
        for (const f of files) {
          await cache.readFile(f.path)
        }
      },
      { warmup: 0, iterations: 10, discardOutliers: 0 }
    )

    // Warm read (hit)
    const hitBench = await runBenchmark(
      "file.hit",
      async () => {
        for (const f of files) {
          await cache.readFile(f.path)
        }
      },
      { warmup: 5, iterations: 50, discardOutliers: 0.1 }
    )

    console.log("\n=== File System Cache ===")
    console.log(`Cache Miss: ${missBench.p50.toFixed(2)}ms (p50)`)
    console.log(`Cache Hit: ${hitBench.p50.toFixed(2)}ms (p50)`)
    console.log(`Speedup: ${(missBench.p50 / hitBench.p50).toFixed(1)}x faster`)

    const stats = cache.getStats()
    console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`)

    expect(hitBench.p50).toBeLessThan(missBench.p50 / 2) // At least 2x faster

    // Cleanup
    await rm(testDir, { recursive: true })
  })

  test("Session State Cache - Performance", async () => {
    const cache = new SessionStateCache()
    const sessionID = "bench-session"

    // Set operation
    const setBench = await runBenchmark(
      "session.set",
      async () => {
        cache.set(sessionID, {
          modelID: "claude-3-opus",
          status: "running",
          timestamp: Date.now()
        })
      },
      { warmup: 100, iterations: 1000, discardOutliers: 0.05 }
    )

    // Get operation (hit)
    const getBench = await runBenchmark(
      "session.get",
      async () => {
        cache.get(sessionID)
      },
      { warmup: 100, iterations: 1000, discardOutliers: 0.05 }
    )

    console.log("\n=== Session State Cache ===")
    console.log(`Set: ${setBench.p50.toFixed(3)}ms (p50)`)
    console.log(`Get: ${getBench.p50.toFixed(3)}ms (p50)`)
    
    expect(setBench.p50).toBeLessThan(0.1) // Should be sub-millisecond
    expect(getBench.p50).toBeLessThan(0.1)
  })
})

describe("Performance Benchmarks - Wave 3", () => {
  
  test("Parallel Processing - Sequential vs Parallel", async () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    
    // Simulate async work
    const processor = async (n: number) => {
      await new Promise(r => setTimeout(r, 1))
      return n * 2
    }

    // Sequential
    const sequential = await runBenchmark(
      "parallel.sequential",
      async () => {
        const results: number[] = []
        for (const item of items) {
          results.push(await processor(item))
        }
        return results
      },
      { warmup: 3, iterations: 10, discardOutliers: 0 }
    )

    // Parallel with limit
    const parallel = await runBenchmark(
      "parallel.parallel",
      async () => {
        return parallelWithLimit(items, processor, { concurrency: 10 })
      },
      { warmup: 3, iterations: 10, discardOutliers: 0 }
    )

    console.log("\n=== Parallel Processing ===")
    console.log(`Sequential: ${sequential.p50.toFixed(2)}ms (p50)`)
    console.log(`Parallel: ${parallel.p50.toFixed(2)}ms (p50)`)
    console.log(`Speedup: ${(sequential.p50 / parallel.p50).toFixed(1)}x faster`)

    expect(parallel.p50).toBeLessThan(sequential.p50 / 2) // At least 2x faster
  })

  test("Worker Pool - Concurrency Control", async () => {
    const { WorkerPool } = await import("../src/shared/parallel-utils")
    
    const pool = new WorkerPool(5, async (n: number) => {
      await new Promise(r => setTimeout(r, 5))
      return n * n
    })

    const items = Array.from({ length: 20 }, (_, i) => i)

    const bench = await runBenchmark(
      "workerpool",
      async () => {
        await pool.executeAll(items)
      },
      { warmup: 2, iterations: 5, discardOutliers: 0 }
    )

    console.log("\n=== Worker Pool ===")
    console.log(`20 tasks with concurrency 5: ${bench.p50.toFixed(2)}ms (p50)`)
    console.log(`Expected: ~20ms (4 batches × 5ms each)`)
    
    // Should complete in roughly 4 batches (20 tasks / 5 concurrent = 4 rounds)
    expect(bench.p50).toBeLessThan(100) // Should be well under 100ms
  })
})

describe("Performance Benchmarks - End to End", () => {
  
  test("Combined Optimizations", async () => {
    const testDir = join(tmpdir(), "e2e-bench-" + Date.now())
    await mkdir(testDir, { recursive: true })

    // Setup: Create files
    const files = Array.from({ length: 5 }, (_, i) => ({
      path: join(testDir, `e2e-${i}.txt`),
      content: "content-" + i
    }))
    
    for (const f of files) {
      await writeFile(f.path, f.content)
    }

    // Complex workflow: Read files in parallel, process with hooks
    const bench = await runBenchmark(
      "e2e.combined",
      async () => {
        // Parallel file reads
        const contents = await parallelWithLimit(
          files.map(f => f.path),
          async (path) => fileSystemCache.readFile(path),
          { concurrency: 3 }
        )

        // Process with hooks
        const hooks = [
          { name: "processor", execute: (input: unknown) => input }
        ]
        
        for (const content of contents) {
          if (content) {
            executeHooksForEvent("test", hooks, content, {}, { featureEnabled: false })
          }
        }
      },
      { warmup: 5, iterations: 20, discardOutliers: 0.1 }
    )

    console.log("\n=== End to End Combined ===")
    console.log(`Parallel reads + hook processing: ${bench.p50.toFixed(2)}ms (p50)`)
    console.log(`p95: ${bench.p95.toFixed(2)}ms`)
    console.log(`StdDev: ${bench.stdDev.toFixed(2)}ms`)

    // Cleanup
    await rm(testDir, { recursive: true })
  })
})

describe("Performance Report", () => {
  test("Generate Full Metrics Report", () => {
    const report = perfMonitor.report()
    
    console.log("\n" + "=".repeat(60))
    console.log("PERFORMANCE METRICS REPORT")
    console.log("=".repeat(60))
    
    const metrics = Object.entries(report).sort((a, b) => b[1].count - a[1].count)
    
    for (const [name, data] of metrics.slice(0, 10)) {
      console.log(`\n${name}:`)
      console.log(`  Count: ${data.count}`)
      console.log(`  Avg: ${data.avg.toFixed(3)}ms`)
      console.log(`  P50: ${data.p50.toFixed(3)}ms`)
      console.log(`  P95: ${data.p95.toFixed(3)}ms`)
      console.log(`  Min/Max: ${data.min.toFixed(3)}ms / ${data.max.toFixed(3)}ms`)
    }
    
    console.log("\n" + "=".repeat(60))
    
    // Verify we have metrics
    expect(Object.keys(report).length).toBeGreaterThan(0)
  })
})

// Baseline comparison helper
function comparePerformance(
  name: string,
  baseline: number,
  optimized: number
): void {
  const improvement = ((baseline - optimized) / baseline * 100)
  const speedup = baseline / optimized
  
  console.log(`\n${name}:`)
  console.log(`  Baseline: ${baseline.toFixed(2)}ms`)
  console.log(`  Optimized: ${optimized.toFixed(2)}ms`)
  console.log(`  Improvement: ${improvement.toFixed(1)}% (${speedup.toFixed(1)}x faster)`)
}
