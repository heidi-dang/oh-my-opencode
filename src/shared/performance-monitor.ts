/**
 * Performance Monitor
 * 
 * Wave 0: Instrumentation before optimization
 * 
 * Provides measurement infrastructure for:
 * - Hook execution timing
 * - File I/O tracking  
 * - Session state API calls
 * - Database query timing
 * - Memory usage tracking
 */

interface Counter {
  count: number
  totalTime: number
  minTime: number
  maxTime: number
  samples: number[] // Last 100 samples for percentile calculation
}

export class PerformanceMonitor {
  private counters = new Map<string, Counter>()
  private readonly MAX_SAMPLES = 100
  
  /**
   * Measure synchronous function execution
   */
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start
    
    this.recordMeasurement(name, duration)
    return result
  }
  
  /**
   * Measure asynchronous function execution
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    
    this.recordMeasurement(name, duration)
    return result
  }
  
  /**
   * Record a measurement
   */
  private recordMeasurement(name: string, duration: number): void {
    const existing = this.counters.get(name)
    
    if (!existing) {
      this.counters.set(name, {
        count: 1,
        totalTime: duration,
        minTime: duration,
        maxTime: duration,
        samples: [duration]
      })
      return
    }
    
    existing.count++
    existing.totalTime += duration
    existing.minTime = Math.min(existing.minTime, duration)
    existing.maxTime = Math.max(existing.maxTime, duration)
    
    // Keep last N samples for percentile calculation
    existing.samples.push(duration)
    if (existing.samples.length > this.MAX_SAMPLES) {
      existing.samples.shift()
    }
  }
  
  /**
   * Get metrics report
   */
  report(): Record<string, {
    count: number
    avg: number
    min: number
    max: number
    p50: number
    p95: number
    p99: number
  }> {
    const report: Record<string, any> = {}
    
    for (const [name, counter] of this.counters) {
      const sorted = [...counter.samples].sort((a, b) => a - b)
      
      report[name] = {
        count: counter.count,
        avg: counter.totalTime / counter.count,
        min: counter.minTime,
        max: counter.maxTime,
        p50: this.percentile(sorted, 0.5),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99)
      }
    }
    
    return report
  }
  
  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }
  
  /**
   * Get specific metric
   */
  getMetric(name: string): Counter | undefined {
    return this.counters.get(name)
  }
  
  /**
   * Reset all counters
   */
  reset(): void {
    this.counters.clear()
  }
  
  /**
   * Get counter names
   */
  getCounterNames(): string[] {
    return Array.from(this.counters.keys())
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor()

// Baseline metrics to track
export const BaselineMetrics = {
  // Hook execution
  HOOK_EXECUTION: 'hook.execution',
  HOOK_EXECUTION_COUNT: 'hook.execution.count',
  
  // File I/O
  FILE_READ: 'file.read',
  FILE_READ_COUNT: 'file.read.count',
  
  // Session state
  SESSION_STATE_FETCH: 'session.state.fetch',
  SESSION_STATE_FETCH_COUNT: 'session.state.fetch.count',
  
  // Database
  DB_QUERY: 'db.query',
  DB_QUERY_COUNT: 'db.query.count',
  
  // Message transforms
  MESSAGE_TRANSFORM: 'message.transform',
  MESSAGE_TRANSFORM_COUNT: 'message.transform.count',
  
  // Memory (manual tracking)
  MEMORY_HEAP: 'memory.heap'
} as const

// Benchmark harness
export async function runBenchmark<T>(
  name: string,
  fn: () => Promise<T>,
  options: {
    warmup: number
    iterations: number
    discardOutliers: number // 0-1, percentage to discard from each end
  }
): Promise<{
  name: string
  p50: number
  p95: number
  p99: number
  stdDev: number
  min: number
  max: number
}> {
  const times: number[] = []
  
  // Warmup
  for (let i = 0; i < options.warmup; i++) {
    await fn()
  }
  
  // Measure
  for (let i = 0; i < options.iterations; i++) {
    // Force GC if available for isolation
    if (global.gc) {
      global.gc()
    }
    
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  
  // Sort and discard outliers
  times.sort((a, b) => a - b)
  const discardCount = Math.floor(times.length * options.discardOutliers)
  const cleanTimes = times.slice(discardCount, times.length - discardCount)
  
  // Calculate statistics
  const sum = cleanTimes.reduce((a, b) => a + b, 0)
  const avg = sum / cleanTimes.length
  const variance = cleanTimes.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / cleanTimes.length
  
  return {
    name,
    p50: percentile(cleanTimes, 0.5),
    p95: percentile(cleanTimes, 0.95),
    p99: percentile(cleanTimes, 0.99),
    stdDev: Math.sqrt(variance),
    min: cleanTimes[0],
    max: cleanTimes[cleanTimes.length - 1]
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, index)]
}

// Standard deviation helper
export function standardDeviation(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length
  return Math.sqrt(variance)
}
