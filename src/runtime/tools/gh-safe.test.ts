import { describe, expect, it } from "bun:test"
import { createGhSafeTool } from "./gh-safe"

describe("gh_safe tool", () => {
    it("should return a ToolDefinition", () => {
        const tool = createGhSafeTool()
        expect(tool).toBeDefined()
        expect(tool.description).toContain("GitHub CLI")
        expect(typeof tool.execute).toBe("function")
    })
})
