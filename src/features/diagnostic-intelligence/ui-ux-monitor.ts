/**
 * UI/UX Diagnostic Monitor — Active listener for frontend visual and interaction bugs.
 * 
 * Works by attaching global event listeners in the DOM (assuming this runs in
 * a browser/electron renderer process) to detect rage clicks, layout thrashing,
 * and element overlap without requiring changes to the user's React components.
 */

import { log } from "../../shared/logger"
import type { ClassifiedDiagnostic, DiagnosticClass } from "./types"

// Stub DOM types for Node.js compilation context
type EventTarget = any
type MouseEvent = any
type HTMLElement = any
interface PerformanceObserverEntry {
  getEntries(): any[]
}
interface PerformanceObserver {
  observe(options: any): void
  disconnect(): void
}
declare const window: any
declare const document: any
declare const PerformanceObserver: any

export type UiUxMonitorCallback = (diagnostic: ClassifiedDiagnostic) => void

export class UiUxDiagnosticMonitor {
  private static instance: UiUxDiagnosticMonitor
  private subscribers: UiUxMonitorCallback[] = []
  private isListening = false

  // Rage click tracking
  private clickHistory: { time: number; x: number; y: number; target: EventTarget | null }[] = []
  
  // Layout shift tracking
  private observer: PerformanceObserver | null = null

  private constructor() {}

  public static getInstance(): UiUxDiagnosticMonitor {
    if (!UiUxDiagnosticMonitor.instance) {
      UiUxDiagnosticMonitor.instance = new UiUxDiagnosticMonitor()
    }
    return UiUxDiagnosticMonitor.instance
  }

  public subscribe(callback: UiUxMonitorCallback): () => void {
    this.subscribers.push(callback)
    if (!this.isListening) {
      this.startListening()
    }
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  private startListening() {
    // Only run if we are in a DOM environment
    if (typeof window === "undefined" || typeof document === "undefined") {
      log("[UiUxMonitor] Not in a DOM environment, skipping initialization")
      return
    }

    this.isListening = true
    this.attachRageClickDetector()
    this.attachLayoutShiftDetector()
  }

  public stopListening() {
    this.isListening = false
    if (typeof window !== "undefined") {
      document.removeEventListener("click", this.handleDocumentClick)
    }
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  }

  /**
   * Rage Click Detector
   * Detects if the user clicks the exact same spot (or element) >4 times in 2 seconds.
   */
  private attachRageClickDetector() {
    document.addEventListener("click", this.handleDocumentClick, { capture: true })
  }

  private handleDocumentClick = (event: MouseEvent) => {
    const now = Date.now()
    const x = event.clientX
    const y = event.clientY

    // Cleanup old clicks
    this.clickHistory = this.clickHistory.filter(c => now - c.time < 2000)

    // Add new click
    this.clickHistory.push({ time: now, x, y, target: event.target })

    if (this.clickHistory.length >= 4) {
      // Check if they are all within a 20px radius (rage clicking a frozen button)
      const allClose = this.clickHistory.every(c => 
        Math.abs(c.x - x) < 20 && Math.abs(c.y - y) < 20
      )

      if (allClose) {
        let identifier = "Unknown Element"
        const element = event.target as any
        if (element) {
          identifier = element.tagName.toLowerCase()
          if (element.id) identifier += `#${element.id}`
          if (element.className && typeof element.className === "string") {
            identifier += `.${element.className.split(" ")[0]}`
          }
          if (element.innerText) {
            identifier += ` (Text: "${element.innerText.substring(0, 15)}")`
          }
        }

        this.emitDiagnostic(
          "diagnostic.unresponsive-target",
          identifier,
          `Rage click detected (4+ clicks in 2s). The element "${identifier}" is unresponsive. Check for missing async loading states, invisible overlapping overlays, or broken click handlers.`
        )
        
        // Clear history so we don't spam emit for the 5th, 6th click, etc.
        this.clickHistory = []
      }
    }
  }

  /**
   * Cumulative Layout Shift (CLS) Detector
   * Uses PerformanceObserver to detect elements shifting around after render.
   */
  private attachLayoutShiftDetector() {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return

    try {
      this.observer = new (window.PerformanceObserver as any)((list: any) => {
        for (const entry of list.getEntries()) {
          // Layout shift entries have a 'value' and 'sources' array
          const shiftEntry = entry as any
          if (shiftEntry.value > 0.1 && shiftEntry.sources && shiftEntry.sources.length > 0) {
            const source = shiftEntry.sources[0]
            const element = source.node as any
            
            if (element) {
              let identifier = element.tagName?.toLowerCase() || "element"
              if (element.id) identifier += `#${element.id}`
              if (element.className && typeof element.className === 'string') {
                const firstClass = element.className.split(" ")[0]
                if (firstClass) identifier += `.${firstClass}`
              }
              
              this.emitDiagnostic(
                "diagnostic.layout-shift-cls",
                identifier,
                `Significant Cumulative Layout Shift detected (score: ${shiftEntry.value.toFixed(2)}). An image or asynchronous component pushed content down. Apply reserved dimensions, aspect-ratio bounds, or skeleton loaders to "${identifier}".`
              )
            }
          }
        }
      })

      this.observer?.observe({ type: "layout-shift", buffered: true })
    } catch (err) {
      log(`[UiUxMonitor] PerformanceObserver failed to start: ${err}`)
    }
  }

  /**
   * Expose a generic manual reporting method so frontend components
   * like Error Boundaries can pipe their crashes into the agent engine.
   */
  public reportReactErrorBoundary(error: Error, componentStack: string) {
    this.emitDiagnostic(
      "diagnostic.web-ui-react-error-boundary",
      "React Component",
      `React render panic: ${error.message}\nComponent Stack:\n${componentStack}`
    )
  }

  private emitDiagnostic(diagnosticClass: DiagnosticClass, symbol: string, message: string) {
    const diagnostic: ClassifiedDiagnostic = {
      class: diagnosticClass,
      language: "ui-ux",
      symbol,
      file: "DOM Frontend",
      line: 0,
      raw_message: message,
      severity: "warning",
      source: "ui-ux-monitor"
    }
    
    // Auto-throttle: Don't spam the exact same diagnostic rapidly
    log(`[UiUxMonitor] ${diagnosticClass}: ${message}`)
    
    for (const callback of this.subscribers) {
      try {
        callback(diagnostic)
      } catch (err) {
        log(`[UiUxMonitor] Error in subscriber: ${err}`)
      }
    }
  }
}

export const uiUxMonitor = UiUxDiagnosticMonitor.getInstance()
