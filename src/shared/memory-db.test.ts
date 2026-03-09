import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { memoryDB } from "./memory-db"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { getOpenCodeConfigDir } from "./opencode-config-dir"

describe("MemoryDB", () => {
  const testCategory = "test-category"
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
      category: "other-cat",
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
      category: "temp",
      content: "to be deleted",
      tags: "temp"
    })

    memoryDB.delete(id)
    const results = memoryDB.query({ keyword: "to be deleted" })
    expect(results.some(r => r.id === id)).toBe(false)
  })
})
