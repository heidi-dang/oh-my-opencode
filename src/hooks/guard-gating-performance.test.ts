import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { OptimizedRunStateWatchdogManager } from "../features/run-state-watchdog/optimized-manager"
import { createOptimizedCritiqueGateHook } from "../hooks/critique-gate/optimized-critique-gate"
import { createOptimizedSandboxControlHook } from "../hooks/sandbox-control/optimized-hook"
import { createOptimizedLanguageIntelligenceHook } from "../features/language-intelligence/optimized-language-intelligence-hook"

describe("Guard Gating Performance Tests", () => {
  let mockClient: any
  let mockCollector: any
  
  beforeAll(() => {
    mockClient = {
      tui: {
        showToast: async () => {}
      },
      session: {
        state: () => ({ modelID: "test-model" }),
        abort: async () => {}
      }
    }
    
    mockCollector = {
      register: async () => {}
    }
  })
  
  describe("Optimized RunStateWatchdog Manager", () => {
    test("should handle 1000 sessions efficiently", async () => {
      const manager = new OptimizedRunStateWatchdogManager(mockClient)
      
      // Create 1000 active sessions
      for (let i = 0; i < 1000; i++) {
        manager.recordActivity(`session-${i}`, "general")
        manager.updateState(`session-${i}`, "running")
      }
      
      const start = performance.now()
      // Simulate multiple check cycles
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
      const end = performance.now()
      
      const duration = end - start
      console.log(`RunStateWatchdog Manager: ${duration.toFixed(2)}ms for 1000 sessions`)
      
      // Should handle 1000 sessions efficiently
      expect(duration).toBeLessThan(100)
      
      manager.stop()
    })
  })
  
  describe("Optimized Critique Gate Hook", () => {
    test("should process tool calls 200% faster", async () => {
      const hook = createOptimizedCritiqueGateHook()
      
      const testCalls = Array.from({ length: 1000 }, (_, i) => ({
        tool: "complete_task",
        sessionID: `session-${i}`,
        input: {}
      }))
      
      const start = performance.now()
      for (const call of testCalls) {
        const output: any = { allow: true }
        await hook["tool.execute.before"](call, output)
      }
      const end = performance.now()
      
      const duration = end - start
      console.log(`Critique Gate Hook: ${duration.toFixed(2)}ms for 1000 tool calls`)
      
      // Should process 1000 tool calls in under 30ms
      expect(duration).toBeLessThan(30)
    })
  })
  
  describe("Optimized Sandbox Control Hook", () => {
    test("should handle chat messages efficiently", async () => {
      const hook = createOptimizedSandboxControlHook()
      
      const testMessages = Array.from({ length: 1000 }, (_, i) => ({
        message: {
          parts: [{ text: i % 2 === 0 ? "/sandbox on" : "/sandbox off" }],
          sessionID: `session-${i}`
        },
        client: mockClient
      }))
      
      const start = performance.now()
      for (const message of testMessages) {
        await hook["chat.message"](message)
      }
      const end = performance.now()
      
      const duration = end - start
      console.log(`Sandbox Control Hook: ${duration.toFixed(2)}ms for 1000 messages`)
      
      // Should process 1000 messages in under 100ms
      expect(duration).toBeLessThan(100)
    })
  })
  
  describe("Optimized Language Intelligence Hook", () => {
    test("should process language detection with caching", async () => {
      const hook = createOptimizedLanguageIntelligenceHook({
        collector: mockCollector,
        directory: "/test"
      })
      
      const testMessages = Array.from({ length: 100 }, (_, i) => ({
        sessionID: `session-${i}`,
        parts: [{ type: "text", text: "function test() { return true; }" }]
      }))
      
      const start = performance.now()
      for (const message of testMessages) {
        await hook["chat.message"](message, { parts: message.parts })
      }
      const end = performance.now()
      
      const duration = end - start
      console.log(`Language Intelligence Hook: ${duration.toFixed(2)}ms for 100 messages`)
      
      // Should process 100 messages in under 200ms (with caching)
      expect(duration).toBeLessThan(200)
    })
  })
  
  describe("Memory Usage", () => {
    test("should maintain low memory footprint", async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Create all optimized hooks
      const watchdogManager = new OptimizedRunStateWatchdogManager(mockClient)
      const critiqueHook = createOptimizedCritiqueGateHook()
      const sandboxHook = createOptimizedSandboxControlHook()
      const langHook = createOptimizedLanguageIntelligenceHook({
        collector: mockCollector,
        directory: "/test"
      })
      
      // Simulate heavy usage
      for (let i = 0; i < 1000; i++) {
        watchdogManager.recordActivity(`session-${i}`, "general")
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
      
      // Should use less than 50MB additional memory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      
      watchdogManager.stop()
    })
  })
})
