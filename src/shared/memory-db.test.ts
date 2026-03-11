import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { memoryDB } from "./memory-db"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { getOpenCodeConfigDir } from "./opencode-config-dir"

describe("MemoryDB", () => {
  const testCategory = "agent_hint" as const
  const testContent = "This is a test memory"
  const testTags = "test, sqlite, bun"

  it("should save and retrieve a memory item", () => {
    const id = memoryDB.save({
      category: testCategory,
      content: testContent,
      tags: testTags
    })

    expect(id).toBeGreaterThan(0)

    const results = memoryDB.query({ keyword: "test memory" })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toBe(testContent)
    expect(results[0].category).toBe(testCategory)
  })

  it("should filter by category", () => {
    memoryDB.save({
      category: "task_pattern",
      content: "irrelevant content",
      tags: "none"
    })

    const results = memoryDB.query({ category: testCategory })
    expect(results.every(r => r.category === testCategory)).toBe(true)
  })

  it("should filter by tags", () => {
    const results = memoryDB.query({ tags: "sqlite" })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tags).toContain("sqlite")
  })

  it("should delete a memory item", () => {
    const id = memoryDB.save({
      category: "agent_hint",
      content: "to be deleted",
      tags: "temp"
    })

    memoryDB.delete(id)
    const results = memoryDB.query({ keyword: "to be deleted" })
    expect(results.some(r => r.id === id)).toBe(false)
  })

  it("should markUsed and update last_used_at", () => {
    const id = memoryDB.save({
      category: "failure_signature",
      content: "test signature",
      tags: "test",
      signature: "test.mark-used"
    })

    const before = memoryDB.query({ signature: "test.mark-used" })
    expect(before.length).toBeGreaterThan(0)

    const oldTs = before[0].last_used_at
    // Small delay to ensure timestamp changes
    const start = Date.now()
    while (Date.now() - start < 5) { /* busy wait */ }

    memoryDB.markUsed(id)
    const after = memoryDB.query({ signature: "test.mark-used" })
    expect(after[0].last_used_at).toBeGreaterThanOrEqual(oldTs ?? 0)
  })

  it("should upsert signature-based memories", () => {
    memoryDB.save({
      category: "failure_signature",
      content: "first save",
      tags: "test",
      signature: "test.upsert",
      evidence: ["error A"]
    })

    memoryDB.save({
      category: "failure_signature",
      content: "second save",
      tags: "test",
      signature: "test.upsert",
      evidence: ["error B"]
    })

    const results = memoryDB.query({ signature: "test.upsert" })
    expect(results.length).toBe(1)
    expect(results[0].content).toBe("second save")
    expect(results[0].evidence).toContain("error A")
    expect(results[0].evidence).toContain("error B")
  })
})
