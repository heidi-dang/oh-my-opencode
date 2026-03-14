/**
 * Performance Monitor — Detects event loop blocking, slow operations,
 * and rendering bottlenecks in real-time.
 *
 * Uses monitorEventLoopDelay (perf_hooks) and custom operation timers
 * to flag performance degradation before the user notices.
 */

import { log } from "../../shared/logger"
import type { ClassifiedDiagnostic, DiagnosticClass } from "./types"

export type PerformanceMonitorCallback = (diagnostic: ClassifiedDiagnostic) => void

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private subscribers: PerformanceMonitorCallback[] = []
  private isListening = false
  private eventLoopCheckInterval?: ReturnType<typeof setInterval>
  private fileReadTracker = new Map<string, { count: number; lastRead: number }>()

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  public subscribe(callback: PerformanceMonitorCallback): () => void {
    this.subscribers.push(callback)
    if (!this.isListening) {
      this.startListening()
    }
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  private startListening() {
    this.isListening = true
    this.startEventLoopMonitor()
  }

  public stopListening() {
    this.isListening = false
    if (this.eventLoopCheckInterval) {
      clearInterval(this.eventLoopCheckInterval)
      this.eventLoopCheckInterval = undefined
    }
  }

  /**
   * Event Loop Block Detection
   * Measures the difference between expected and actual timer execution.
   * If the event loop is blocked by synchronous work, the timer fires late.
   */
  private startEventLoopMonitor() {
    let lastTick = Date.now()

    this.eventLoopCheckInterval = setInterval(() => {
      const now = Date.now()
      const delay = now - lastTick - 1000 // Expected 1000ms interval
      lastTick = now

      // If the event loop was blocked for >200ms, that's a significant stall
      if (delay > 200) {
        log(`[PerformanceMonitor] Event loop blocked for ${delay}ms`)
        this.emitDiagnostic(
          "diagnostic.event-loop-block",
          "event-loop",
          `Event loop was blocked for ${delay}ms. A synchronous operation is starving async I/O. Find and offload it to a Worker or use setImmediate.`
        )
      }
    }, 1000)

    if (this.eventLoopCheckInterval.unref) {
      this.eventLoopCheckInterval.unref()
    }
  }

  /**
   * Track file reads to detect excessive re-reads of the same file.
   * Call this from file-reading hooks to detect cache-miss patterns.
   */
  public trackFileRead(filePath: string) {
    const now = Date.now()
    const existing = this.fileReadTracker.get(filePath)

    if (existing) {
      existing.count++
      // If the same file is read more than 10 times in 30 seconds, flag it
      if (existing.count > 10 && now - existing.lastRead < 30000) {
        this.emitDiagnostic(
          "diagnostic.excessive-fs-reads",
          filePath,
          `File "${filePath}" has been read ${existing.count} times in ${((now - existing.lastRead) / 1000).toFixed(1)}s. Cache the result in memory instead of re-reading from disk.`
        )
        existing.count = 0
        existing.lastRead = now
      }
    } else {
      this.fileReadTracker.set(filePath, { count: 1, lastRead: now })
    }

    // Prevent the tracker itself from leaking by capping at 500 entries
    if (this.fileReadTracker.size > 500) {
      const oldestKey = this.fileReadTracker.keys().next().value
      if (oldestKey) {
        this.fileReadTracker.delete(oldestKey)
      }
    }
  }

  /**
   * Measure a specific operation's duration and flag if it exceeds the threshold.
   * Use this to wrap SQLite queries, regex evaluations, etc.
   */
  public measureOperation<T>(
    operationName: string,
    diagnosticClass: DiagnosticClass,
    thresholdMs: number,
    fn: () => T
  ): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start

    if (duration > thresholdMs) {
      this.emitDiagnostic(
        diagnosticClass,
        operationName,
        `Operation "${operationName}" took ${duration.toFixed(2)}ms (threshold: ${thresholdMs}ms). Optimize or offload this operation.`
      )
    }

    return result
  }

  /**
   * Async version of measureOperation for awaitable functions.
   */
  public async measureAsyncOperation<T>(
    operationName: string,
    diagnosticClass: DiagnosticClass,
    thresholdMs: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start

    if (duration > thresholdMs) {
      this.emitDiagnostic(
        diagnosticClass,
        operationName,
        `Async operation "${operationName}" took ${duration.toFixed(2)}ms (threshold: ${thresholdMs}ms). Consider caching, batching, or parallelizing.`
      )
    }

    return result
  }

  /**
   * Detect N+1 query patterns.
   * Call startBatch() before a loop that might issue queries,
   * then trackQuery() inside the loop.
   */
  private batchTracker = new Map<string, { count: number; startTime: number }>()

  public startBatch(batchId: string) {
    this.batchTracker.set(batchId, { count: 0, startTime: Date.now() })
  }

  public trackQuery(batchId: string, queryDescription: string) {
    const batch = this.batchTracker.get(batchId)
    if (!batch) return

    batch.count++

    // If more than 5 individual queries in a single batch, flag N+1
    if (batch.count > 5) {
      this.emitDiagnostic(
        "diagnostic.n-plus-one-query",
        queryDescription,
        `N+1 query pattern detected in batch "${batchId}": ${batch.count} individual queries issued. Refactor to a single batched query using Promise.all or SQL IN clause.`
      )
      this.batchTracker.delete(batchId)
    }
  }

  public endBatch(batchId: string) {
    this.batchTracker.delete(batchId)
  }

  private emitDiagnostic(diagnosticClass: DiagnosticClass, symbol: string, message: string) {
    const diagnostic: ClassifiedDiagnostic = {
      class: diagnosticClass,
      language: "performance",
      symbol,
      file: "runtime-performance",
      line: 0,
      raw_message: message,
      severity: "warning",
      source: "performance-monitor"
    }
    for (const callback of this.subscribers) {
      try {
        callback(diagnostic)
      } catch (err) {
        log(`[PerformanceMonitor] Error in subscriber: ${err}`)
      }
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()
