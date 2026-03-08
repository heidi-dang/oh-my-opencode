import { describe, test, expect } from "bun:test"
import { analyzeDependencies } from "./analyzer"
import { join } from "node:path"

describe("dependency-graph", () => {
  test("analyzeDependencies should return a mermaid graph", async () => {
    const directory = process.cwd()
    const result = await analyzeDependencies("src/tools/dependency-graph", directory)

    expect(result).toContain("graph TD")
    expect(result).toContain("```mermaid")
    expect(result).toContain("analyzer.ts")
  })
})
