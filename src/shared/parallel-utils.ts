/**
 * Safe Parallelization Utilities
 * 
 * Wave 3: Controlled parallel processing
 * 
 * STRICT RULES:
 * 1. Only parallelize provably independent tasks
 * 2. No shared mutable state between parallel tasks
 * 3. No lifecycle transitions in parallel
 * 4. Preserve output order where required
 * 5. Error handling must be robust
 */

import { log } from "./logger"

export interface ParallelOptions {
  concurrency: number
  preserveOrder?: boolean  // If true, results maintain input order
  continueOnError?: boolean  // If false, first error stops all
}

export class ParallelizationError extends Error {
  constructor(
    message: string,
    public errors: Error[]
  ) {
    super(message)
    this.name = 'ParallelizationError'
  }
}

/**
 * Safe parallel processing with controlled concurrency
 * 
 * ONLY for independent, read-only, or isolated tasks
 * NEVER for lifecycle transitions or stateful progression
 */
export async function parallelWithLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: ParallelOptions = { concurrency: 5 }
): Promise<R[]> {
  const { concurrency, preserveOrder = true, continueOnError = true } = options
  
  if (items.length === 0) return []
  if (items.length === 1) return [await processor(items[0])]
  
  const results: R[] = new Array(items.length)
  const errors: Error[] = []
  let index = 0
  let hasError = false
  
  async function worker(): Promise<void> {
    while (true) {
      // Check if we should stop due to error
      if (!continueOnError && hasError) {
        return
      }
      
      const current = index++
      if (current >= items.length) return
      
      try {
        results[current] = await processor(items[current])
      } catch (error) {
        hasError = true
        errors.push(error as Error)
        results[current] = null as R
      }
    }
  }
  
  // Spawn workers
  const workerCount = Math.min(concurrency, items.length)
  const workers = Array.from({ length: workerCount }, () => worker())
  
  await Promise.all(workers)
  
  if (errors.length > 0 && !continueOnError) {
    throw new ParallelizationError(
      `${errors.length} parallel tasks failed`,
      errors
    )
  }
  
  return results
}

/**
 * Parallel map with concurrency control
 */
export async function parallelMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  return parallelWithLimit(items, mapper, { 
    concurrency, 
    preserveOrder: true,
    continueOnError: true 
  })
}

/**
 * Parallel filter with concurrency control
 */
export async function parallelFilter<T>(
  items: T[],
  predicate: (item: T) => Promise<boolean>,
  concurrency: number = 5
): Promise<T[]> {
  const results = await parallelWithLimit(
    items,
    async (item) => ({ item, keep: await predicate(item) }),
    { concurrency, preserveOrder: true, continueOnError: true }
  )
  
  return results
    .filter(r => r.keep)
    .map(r => r.item)
}

/**
 * Batch process with size limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Worker pool for CPU-intensive tasks
 * 
 * Note: In Bun/Node, this spawns tasks on the event loop
 * For true worker threads, use Worker API (not shown here)
 */
export class WorkerPool<T, R> {
  private concurrency: number
  private queue: Array<{
    item: T
    resolve: (result: R) => void
    reject: (error: Error) => void
  }> = []
  private activeWorkers = 0
  private processor: (item: T) => Promise<R>
  
  constructor(concurrency: number, processor: (item: T) => Promise<R>) {
    this.concurrency = concurrency
    this.processor = processor
   }
  
  async execute(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })
      this.processQueue()
    })
  }
  
  async executeAll(items: T[]): Promise<R[]> {
    return Promise.all(items.map(item => this.execute(item)))
  }
  
  private async processQueue(): Promise<void> {
    if (this.activeWorkers >= this.concurrency) return
    if (this.queue.length === 0) return
    
    this.activeWorkers++
    const task = this.queue.shift()
    
    if (task) {
      try {
        const result = await this.processor(task.item)
        task.resolve(result)
      } catch (error) {
        task.reject(error as Error)
      } finally {
        this.activeWorkers--
        // Process next item
        this.processQueue()
      }
    }
  }
  
  getActiveCount(): number {
    return this.activeWorkers
  }
  
  getQueueLength(): number {
    return this.queue.length
  }
}

// Safe usage examples and patterns
export const SafeParallelPatterns = {
  /**
   * GOOD: Independent file reads
   */
  async fileReads(paths: string[], readFile: (path: string) => Promise<string>) {
    return parallelMap(paths, readFile, 10)
  },
  
  /**
   * GOOD: Validation checks (independent)
   */
  async validationChecks(items: unknown[], validator: (item: unknown) => Promise<boolean>) {
    return parallelFilter(items, validator, 5)
  },
  
  /**
   * GOOD: Data transformation (no shared state)
   */
  async dataTransforms<T, R>(items: T[], transformer: (item: T) => Promise<R>) {
    return parallelMap(items, transformer, 5)
  },
  
  /**
   * BAD: Stateful progression (DON'T DO THIS)
   * Each task depends on previous state
   */
  async badStatefulExample(tasks: unknown[]) {
    // DON'T: State changes in parallel
    // return parallelMap(tasks, async task => {
    //   await updateTaskState(task)  // Mutates shared state!
    //   return task
    // })
    
    // DO: Sequential for stateful operations
    for (const task of tasks) {
      await this.sequentialStateUpdate(task)
    }
  },
  
  async sequentialStateUpdate(task: unknown) {
    // Sequential is correct here
    log('Updating state for', task)
  }
}
