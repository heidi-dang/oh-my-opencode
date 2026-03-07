import { describe, expect, test } from "bun:test"
import { validateArgs } from "./tools"

describe("validateArgs", () => {
  // given valid arguments with file_path
  // when validated
  // then return null (no error)
  test("returns null for valid args with file_path", () => {
    const args = { file_path: "/valid/path.png", goal: "analyze" }
    expect(validateArgs(args)).toBeNull()
  })

  // given valid arguments with image_data
  // when validated
  // then return null (no error)
  test("returns null for valid args with image_data", () => {
    const args = { image_data: "data:image/png;base64,iVBORw0KGgo=", goal: "analyze" }
    expect(validateArgs(args)).toBeNull()
  })

  // given neither file_path nor image_data
  // when validated
  // then clear error message
  test("returns error when neither file_path nor image_data provided", () => {
    const args = { goal: "analyze" } as any
    const error = validateArgs(args)
    expect(error).toContain("file_path")
    expect(error).toContain("image_data")
  })

  // given both file_path and image_data
  // when validated
  // then return error (mutually exclusive)
  test("returns error when both file_path and image_data provided", () => {
    const args = { file_path: "/path.png", image_data: "base64data", goal: "analyze" }
    const error = validateArgs(args)
    expect(error).toContain("only one")
  })

  // given goal missing
  // when validated
  // then clear error message
  test("returns error when goal is missing", () => {
    const args = { file_path: "/some/path.png" } as any
    const error = validateArgs(args)
    expect(error).toContain("goal")
    expect(error).toContain("required")
  })

  // given file_path is empty string
  // when validated
  // then return error
  test("returns error when file_path is empty string", () => {
    const args = { file_path: "", goal: "analyze" }
    const error = validateArgs(args)
    expect(error).toContain("file_path")
    expect(error).toContain("image_data")
  })

  // given image_data is empty string
  // when validated
  // then return error
  test("returns error when image_data is empty string", () => {
    const args = { image_data: "", goal: "analyze" }
    const error = validateArgs(args)
    expect(error).toContain("file_path")
    expect(error).toContain("image_data")
  })

  // given file_path is a remote HTTP URL
  // when validated
  // then return error about remote URLs not supported
  test("returns error when file_path is an http:// URL", () => {
    const args = { file_path: "http://example.com/image.png", goal: "analyze" }
    const error = validateArgs(args)
    expect(error).toContain("Remote URLs are not supported")
  })

  // given file_path is a remote HTTPS URL
  // when validated
  // then return error about remote URLs not supported
  test("returns error when file_path is an https:// URL", () => {
    const args = { file_path: "https://example.com/document.pdf", goal: "extract text" }
    const error = validateArgs(args)
    expect(error).toContain("Remote URLs are not supported")
  })

  // given file_path is a remote URL with mixed case scheme
  // when validated
  // then return error (case-insensitive check)
  test("returns error when file_path is a remote URL with mixed case", () => {
    const args = { file_path: "HTTPS://Example.com/file.png", goal: "analyze" }
    const error = validateArgs(args)
    expect(error).toContain("Remote URLs are not supported")
  })
})
