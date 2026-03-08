import { describe, test, expect } from "bun:test"
import { parseCoverageOutput } from "./cli"

describe("test-coverage-analyzer", () => {
  test("parseCoverageOutput should parse successful bun test --coverage output", () => {
    const mockOutput = `bun test v1.3.10 (30e609e0)

-------------------------------------------------|---------|---------|-------------------
File                                             | % Funcs | % Lines | Uncovered Line #s
-------------------------------------------------|---------|---------|-------------------
All files                                        |   10.00 |   33.89 |
 src/shared/logger.ts                            |    0.00 |   45.45 | 9-13
 src/shared/verify-task-completion.ts            |    0.00 |    2.35 | 4-86
 test-setup.ts                                   |    0.00 |   75.00 | 
-------------------------------------------------|---------|---------|-------------------`

    const summary = parseCoverageOutput(mockOutput)

    expect(summary.totalLinesPercent).toBe(33.89)
    expect(summary.totalFunctionsPercent).toBe(10.00)
    expect(summary.results).toHaveLength(3)
    expect(summary.results[0].file).toBe("src/shared/logger.ts")
    expect(summary.results[0].linesPercent).toBe(45.45)
    expect(summary.results[0].uncoveredLines).toBe("9-13")
  })
})
