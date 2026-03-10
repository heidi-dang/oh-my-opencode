import { log } from "./logger"

interface MemoryStats {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  arrayBuffers: number
  hwm: number
}

class MemoryMonitor {
  private hwm = 0
  private lastLogTime = 0
  private readonly LOG_THROTTLE_MS = 5000 
  private readonly COMPACTION_THRESHOLD_MB = 1024 // 1GB RSS trigger

  constructor() {
    this.hwm = process.memoryUsage().rss
  }

  logMemory(label: string, force = false): void {
    const now = Date.now()
    const usage = process.memoryUsage()
    
    if (usage.rss > this.hwm) {
      this.hwm = usage.rss
    }

    if (!force && now - this.lastLogTime < this.LOG_THROTTLE_MS) {
      return
    }

    this.lastLogTime = now
    const stats: MemoryStats = {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
      hwm: Math.round(this.hwm / 1024 / 1024),
    }

    log(`[memory-monitor] ${label}:`, stats)

    if (stats.rss > this.COMPACTION_THRESHOLD_MB) {
      log(`[memory-monitor] CRITICAL MEMORY USAGE (${stats.rss}MB). Recommendation: Trigger compaction.`)
      // Logic to trigger compaction will be implemented in the hook layer where ctx is available.
    }
  }

  getUsage(): MemoryStats {
    const usage = process.memoryUsage()
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      hwm: this.hwm,
    }
  }

  resetHWM(): void {
    this.hwm = process.memoryUsage().rss
  }
}

export const memoryMonitor = new MemoryMonitor()
