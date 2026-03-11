import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { BackgroundManager } from "./manager"
import type { PluginInput } from "@opencode-ai/plugin"

describe("BackgroundManager - Cancellation Deadlock Fix", () => {
  let manager: BackgroundManager
  let mockClient: PluginInput["client"]
  let abortCalls: Array<{ sessionId: string }> = []
  let promptAsyncCalls: Array<{ sessionId: string; notification: string }> = []

  beforeEach(() => {
    abortCalls = []
    promptAsyncCalls = []

    // Create a mock client that tracks abort and prompt calls
    mockClient = {
      session: {
        abort: async ({ path }: { path: { id: string } }) => {
          abortCalls.push({ sessionId: path.id })
          // Simulate the session being aborted
          return { data: {} }
        },
        promptAsync: async ({ path, body }: any) => {
          promptAsyncCalls.push({ 
            sessionId: path.id, 
            notification: body.parts?.[0]?.text || "" 
          })
          // Simulate potential deadlock if this is the same session being aborted
          if (abortCalls.some(call => call.sessionId === path.id)) {
            // This would be the deadlock scenario - notification trying to interact with aborted session
            throw new Error("Session aborted")
          }
          return { data: {} }
        },
        get: async () => ({ data: {} }),
        messages: async () => ({ data: [] }),
      } as any,
    } as PluginInput["client"]

    manager = new BackgroundManager({
      client: mockClient,
      directory: "/tmp",
    } as unknown as PluginInput)
  })

  afterEach(() => {
    manager.shutdown()
  })

  test("cancelTask should not wait for notification (deadlock prevention)", async () => {
    // given
    const task = await manager.launch({
      description: "Test task",
      prompt: "Do something",
      agent: "test-agent",
      parentSessionID: "parent-session",
      parentMessageID: "parent-message",
    })

    // Simulate the task running
    const runningTask = manager.getTask(task.id)
    if (!runningTask) throw new Error("Task not found")
    ;(runningTask as any).status = "running"
    ;(runningTask as any).sessionID = "test-session"

    // when - cancel the task
    const startTime = Date.now()
    const result = await manager.cancelTask(task.id, { source: "test" })
    const endTime = Date.now()

    // then - cancellation should complete immediately without waiting for notification
    expect(result).toBe(true)
    expect(runningTask.status).toBe("cancelled")
    
    // Should not wait for notification (should be very fast, less than 100ms)
    expect(endTime - startTime).toBeLessThan(100)
    
    // Abort should have been called
    expect(abortCalls).toHaveLength(1)
    expect(abortCalls[0].sessionId).toBe("test-session")
    
    // Notification should be attempted asynchronously (fire-and-forget)
    // We need to wait a bit to check if it was attempted
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // The notification might fail due to aborted session, but that's OK
    // The important thing is that cancelTask didn't wait for it
  })

  test("tryCompleteTask should not wait for notification (deadlock prevention)", async () => {
    // given
    const task = await manager.launch({
      description: "Test task",
      prompt: "Do something",
      agent: "test-agent",
      parentSessionID: "parent-session",
      parentMessageID: "parent-message",
    })

    // Simulate the task running
    const runningTask = manager.getTask(task.id)
    if (!runningTask) throw new Error("Task not found")
    ;(runningTask as any).status = "running"
    ;(runningTask as any).sessionID = "test-session"

    // Access private method for testing
    const tryCompleteTask = (manager as any).tryCompleteTask.bind(manager)

    // when - complete the task
    const startTime = Date.now()
    const result = await tryCompleteTask(runningTask, "test")
    const endTime = Date.now()

    // then - completion should not wait for notification
    expect(result).toBe(true)
    expect(runningTask.status).toBe("completed")
    
    // Should not wait for notification (should be very fast, less than 100ms)
    expect(endTime - startTime).toBeLessThan(100)
    
    // Abort should have been called
    expect(abortCalls).toHaveLength(1)
    expect(abortCalls[0].sessionId).toBe("test-session")
  })

  test("multiple concurrent cancellations should not deadlock", async () => {
    // given
    const tasks = []
    for (let i = 0; i < 5; i++) {
      const task = await manager.launch({
        description: `Test task ${i}`,
        prompt: "Do something",
        agent: "test-agent",
        parentSessionID: "parent-session",
        parentMessageID: "parent-message",
      })
      tasks.push(task)
      
      // Simulate tasks running
      const runningTask = manager.getTask(task.id)
      if (runningTask) {
        ;(runningTask as any).status = "running"
        ;(runningTask as any).sessionID = `test-session-${i}`
      }
    }

    // when - cancel all tasks concurrently
    const startTime = Date.now()
    const cancelPromises = tasks.map(task => 
      manager.cancelTask(task.id, { source: "test" })
    )
    const results = await Promise.all(cancelPromises)
    const endTime = Date.now()

    // then - all cancellations should complete quickly without deadlock
    expect(results.every(r => r === true)).toBe(true)
    expect(endTime - startTime).toBeLessThan(200) // Should be very fast
    
    // All tasks should be cancelled
    tasks.forEach(task => {
      const t = manager.getTask(task.id)
      expect(t?.status).toBe("cancelled")
    })
    
    // All aborts should have been called
    expect(abortCalls).toHaveLength(5)
  })

  test("cancellation during notification queue processing should not deadlock", async () => {
    // given
    const task1 = await manager.launch({
      description: "Task 1",
      prompt: "Do something",
      agent: "test-agent",
      parentSessionID: "parent-session",
      parentMessageID: "parent-message",
    })

    const task2 = await manager.launch({
      description: "Task 2",
      prompt: "Do something else",
      agent: "test-agent",
      parentSessionID: "parent-session",
      parentMessageID: "parent-message",
    })

    // Simulate both tasks running
    const runningTask1 = manager.getTask(task1.id)
    const runningTask2 = manager.getTask(task2.id)
    if (!runningTask1 || !runningTask2) throw new Error("Tasks not found")
    
    ;(runningTask1 as any).status = "running"
    ;(runningTask1 as any).sessionID = "test-session-1"
    ;(runningTask2 as any).status = "running"
    ;(runningTask2 as any).sessionID = "test-session-2"

    // Simulate a slow notification for task1
    let notificationResolved = false
    const originalPromptAsync = mockClient.session.promptAsync
    ;(mockClient.session as any).promptAsync = async (args: any) => {
      if (args.path.id === "parent-session" && !notificationResolved) {
        // Simulate slow notification
        await new Promise(resolve => setTimeout(resolve, 100))
        notificationResolved = true
      }
      return { data: {} }
    }

    // when - complete task1 (which will trigger slow notification)
    // then immediately cancel task2
    const tryCompleteTask = (manager as any).tryCompleteTask.bind(manager)
    
    const completePromise = tryCompleteTask(runningTask1, "test")
    
    // Wait a bit to ensure notification is in progress
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Cancel task2 while notification for task1 is in progress
    const cancelStartTime = Date.now()
    const cancelResult = await manager.cancelTask(task2.id, { source: "test" })
    const cancelEndTime = Date.now()

    // then - cancellation should not be blocked by notification
    expect(cancelResult).toBe(true)
    expect(cancelEndTime - cancelStartTime).toBeLessThan(100)
    
    // Wait for completion to finish
    await completePromise
    
    // Both tasks should be in their final states
    expect(runningTask1.status).toBe("completed")
    expect(runningTask2.status).toBe("cancelled")
  })
})
