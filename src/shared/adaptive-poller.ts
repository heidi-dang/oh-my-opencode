/**
 * Adaptive Poller
 * 
 * Wave 4: Consolidated polling with adaptive intervals
 * 
 * Features:
 * - Unified polling loop (1s base tick)
 * - Adaptive intervals (slow down when inactive)
 * - Per-poller configuration
 * - No impact on watchdog latency
 */

import { log } from "./logger"

interface PollingConfig {
  interval: number        // Base interval in ms
  callback: () => void | Promise<void>
  lastRun: number
  inactive: boolean
  checkInactive: () => boolean
  name: string
}

export class AdaptivePoller {
  private pollers = new Map<string, PollingConfig>()
  private timer: NodeJS.Timeout | null = null
  private tickInterval = 1000  // 1 second base tick
  private running = false
  
  /**
   * Register a poller
   */
  register(name: string, config: Omit<PollingConfig, 'lastRun' | 'inactive'> & { 
    initialInactive?: boolean 
  }): void {
    if (this.pollers.has(name)) {
      log(`[AdaptivePoller] Poller ${name} already registered, updating config`)
    }
    
    this.pollers.set(name, {
      ...config,
      lastRun: 0,
      inactive: config.initialInactive ?? false
    })
    
    // Start if not running
    if (!this.running) {
      this.start()
    }
  }
  
  /**
   * Unregister a poller
   */
  unregister(name: string): void {
    this.pollers.delete(name)
    
    // Stop if no pollers left
    if (this.pollers.size === 0) {
      this.stop()
    }
  }
  
  /**
   * Start polling
   */
  start(): void {
    if (this.running) return
    
    this.running = true
    this.timer = setInterval(() => this.tick(), this.tickInterval)
    log(`[AdaptivePoller] Started with ${this.pollers.size} pollers`)
  }
  
  /**
   * Stop polling
   */
  stop(): void {
    if (!this.running) return
    
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
    log('[AdaptivePoller] Stopped')
  }
  
  /**
   * Force immediate execution of a poller
   */
  triggerNow(name: string): void {
    const poller = this.pollers.get(name)
    if (!poller) {
      log(`[AdaptivePoller] Poller ${name} not found`)
      return
    }
    
    this.executePoller(poller)
  }
  
  /**
   * Check if poller exists
   */
  hasPoller(name: string): boolean {
    return this.pollers.has(name)
  }
  
  /**
   * Get poller count
   */
  getPollerCount(): number {
    return this.pollers.size
  }
  
  /**
   * Main tick loop
   */
  private tick(): void {
    const now = Date.now()
    
    for (const [name, poller] of this.pollers) {
      const timeSinceLast = now - poller.lastRun
      
      // Adaptive interval calculation
      let adjustedInterval = poller.interval
      
      if (poller.inactive) {
        // Slow down when inactive (max 2x slower)
        adjustedInterval = Math.min(poller.interval * 2, 30000) // Cap at 30s
      }
      
      // Check if it's time to run
      if (timeSinceLast >= adjustedInterval) {
        this.executePoller(poller)
        
        // Update inactive status for next tick
        try {
          poller.inactive = poller.checkInactive()
        } catch (error) {
          log(`[AdaptivePoller] Error checking inactive status for ${name}:`, error)
          poller.inactive = false  // Safe fallback
        }
      }
    }
  }
  
  /**
   * Execute a single poller
   */
  private executePoller(poller: PollingConfig): void {
    const start = Date.now()
    
    try {
      const result = poller.callback()
      
      // Handle async callbacks
      if (result && typeof result === 'object' && 'then' in result) {
        (result as Promise<void>).catch(error => {
          log(`[AdaptivePoller] Async error in ${poller.name}:`, error)
        })
      }
    } catch (error) {
      log(`[AdaptivePoller] Error in ${poller.name}:`, error)
    } finally {
      poller.lastRun = Date.now()
      
      const duration = poller.lastRun - start
      if (duration > 100) {
        log(`[AdaptivePoller] ${poller.name} took ${duration}ms (slow)`)
      }
    }
  }
}

// Singleton instance
export const adaptivePoller = new AdaptivePoller()

// Convenience functions for common polling patterns
export const PollerPatterns = {
  /**
   * Background task poller
   */
  backgroundTaskPoller(callback: () => void): PollingConfig {
    return {
      name: 'background-task',
      interval: 3000,  // 3s
      callback,
      lastRun: 0,
      inactive: false,
      checkInactive: () => {
        // Check if no tasks running
        return false  // Override with actual check
      }
    }
  },
  
  /**
   * Watchdog poller - needs to be responsive
   */
  watchdogPoller(callback: () => void): PollingConfig {
    return {
      name: 'watchdog',
      interval: 10000,  // 10s
      callback,
      lastRun: 0,
      inactive: false,
      checkInactive: () => {
        // Never slow down watchdog
        return false
      }
    }
  },
  
  /**
   * Idle check poller
   */
  idleCheckPoller(callback: () => void): PollingConfig {
    return {
      name: 'idle-check',
      interval: 5000,  // 5s
      callback,
      lastRun: 0,
      inactive: false,
      checkInactive: () => {
        // Slow down if session not idle
        return false  // Override with actual check
      }
    }
  }
}

// Migration helper from legacy polling
export function migrateLegacyPoller(
  name: string,
  legacyInterval: NodeJS.Timeout | undefined,
  callback: () => void,
  intervalMs: number
): void {
  // Clear legacy interval if exists
  if (legacyInterval) {
    clearInterval(legacyInterval)
  }
  
  // Register with adaptive poller
  adaptivePoller.register(name, {
    name,
    interval: intervalMs,
    callback,
    checkInactive: () => false  // Default - override as needed
  })
}
