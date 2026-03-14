import { log } from "../../shared/logger"
import type { ClassifiedDiagnostic } from "./types"

export type MemoryWatchdogCallback = (diagnostic: ClassifiedDiagnostic) => void

export class MemoryWatchdog {
  private static instance: MemoryWatchdog
  private isListening = false
  private subscribers: MemoryWatchdogCallback[] = []
  private intervalId?: ReturnType<typeof setInterval>
  
  // 1.5 GB limit before we trigger a panic 
  // OpenCode runs inside the renderer or extension host which can handle up to 2-4GB usually,
  // but anything over 1.5GB likely means we have a severe leak.
  private heapLimitBytes = 1.5 * 1024 * 1024 * 1024 
  
  private lastHeapUsed = 0
  private thrashCount = 0

  private constructor() {}

  public static getInstance(): MemoryWatchdog {
    if (!MemoryWatchdog.instance) {
      MemoryWatchdog.instance = new MemoryWatchdog()
    }
    return MemoryWatchdog.instance
  }

  public subscribe(callback: MemoryWatchdogCallback): () => void {
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
    
    // Check every 10 seconds
    this.intervalId = setInterval(() => {
      this.checkMemory()
    }, 10000)
    
    // Unref so we don't hold the node process open just for this timer
    if (this.intervalId.unref) {
      this.intervalId.unref()
    }
  }

  public stopListening() {
    this.isListening = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  private checkMemory() {
    const memoryData = process.memoryUsage()
    const heapUsed = memoryData.heapUsed

    // 1. Check for absolute heap exhaustion
    if (heapUsed > this.heapLimitBytes) {
      log(`[MemoryWatchdog] HEAP EXHAUSTION DETECTED: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`)
      const diagnostic: ClassifiedDiagnostic = {
        class: "diagnostic.v8-heap-exhaustion",
        language: "runtime",
        symbol: "MemoryHeap",
        file: "process.memoryUsage()",
        line: 0,
        raw_message: `Memory Usage Exceeded Threshold: Heap used is ${(heapUsed / 1024 / 1024).toFixed(2)} MB (Limit: 1.5 GB). Immediate state purge required.`,
        severity: "error",
        source: "node-process"
      }
      this.notifySubscribers(diagnostic)
      
      // Auto-throttle: Avoid hammering the agent with memory diagnostics if we are already above the limit
      // Wait 2 minutes before triggering again
      this.stopListening()
      setTimeout(() => this.startListening(), 120000)
      return
    }

    // 2. Check for GC Thrashing / Unbounded growth rate
    // If heap used drops significantly, GC ran.
    // Thrashing implies rapidly creating so many objects that GC runs constantly,
    // or memory grows huge extremely fast (e.g. +500MB in 10s)
    const diff = heapUsed - this.lastHeapUsed
    
    if (this.lastHeapUsed > 0 && diff > 500 * 1024 * 1024) {
      this.thrashCount++
    }

    if (this.thrashCount >= 3) {
      log(`[MemoryWatchdog] GC THRASHING DETECTED`)
      const diagnostic: ClassifiedDiagnostic = {
        class: "diagnostic.v8-gc-thrashing",
        language: "runtime",
        symbol: "GarbageCollector",
        file: "process.memoryUsage()",
        line: 0,
        raw_message: `Severe Memory Thrashing: Heap grew by >500MB rapidly in successive intervals.`,
        severity: "warning", // Warning because it hasn't crashed yet
        source: "node-process"
      }
      this.notifySubscribers(diagnostic)
      
      this.thrashCount = 0
      this.stopListening()
      setTimeout(() => this.startListening(), 120000)
    } else if (diff < 0) {
      // GC ran and recovered memory, reset thrash counter
      this.thrashCount = 0
    }

    this.lastHeapUsed = heapUsed
  }

  private notifySubscribers(diagnostic: ClassifiedDiagnostic) {
    for (const callback of this.subscribers) {
      try {
        callback(diagnostic)
      } catch (err) {
        log(`[MemoryWatchdog] Error in subscriber: ${err}`)
      }
    }
  }
}

export const memoryWatchdog = MemoryWatchdog.getInstance()
