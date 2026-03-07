import { describe, expect, test } from "bun:test"
import { normalizeArgs } from "./tools"

describe("normalizeArgs", () => {
  // given LLM might use `path` instead of `file_path`
  // when called with path parameter
  // then should normalize to file_path
  test("normalizes path to file_path for LLM compatibility", () => {
    const args = { path: "/some/file.png", goal: "analyze" }
    const normalized = normalizeArgs(args as any)
    expect(normalized.file_path).toBe("/some/file.png")
    expect(normalized.goal).toBe("analyze")
  })

  // given proper file_path usage
  // when called with file_path parameter
  // then keep as-is
  test("keeps file_path when properly provided", () => {
    const args = { file_path: "/correct/path.pdf", goal: "extract" }
    const normalized = normalizeArgs(args)
    expect(normalized.file_path).toBe("/correct/path.pdf")
  })

  // given both parameters provided
  // when file_path and path are both present
  // then prefer file_path
  test("prefers file_path over path when both provided", () => {
    const args = { file_path: "/preferred.png", path: "/fallback.png", goal: "test" }
    const normalized = normalizeArgs(args as any)
    expect(normalized.file_path).toBe("/preferred.png")
  })

  // given image_data provided
  // when called with base64 image data
  // then preserve image_data in normalized args
  test("preserves image_data when provided", () => {
    const args = { image_data: "data:image/png;base64,iVBORw0KGgo=", goal: "analyze" }
    const normalized = normalizeArgs(args as any)
    expect(normalized.image_data).toBe("data:image/png;base64,iVBORw0KGgo=")
    expect(normalized.file_path).toBeUndefined()
  })
})
