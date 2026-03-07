import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test"

import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import * as dataPath from "./data-path"
import { shouldRetryError, selectFallbackProvider, isUnsupportedModelError } from "./model-error-classifier"

const TEST_CACHE_DIR = join(import.meta.dir, "__test-cache__")

describe("model-error-classifier", () => {
  let cacheDirSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    cacheDirSpy = spyOn(dataPath, "getOmoOpenCodeCacheDir").mockReturnValue(TEST_CACHE_DIR)
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true })
    }
    mkdirSync(TEST_CACHE_DIR, { recursive: true })
  })

  afterEach(() => {
    cacheDirSpy.mockRestore()
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true })
    }
  })

  test("treats overloaded retry messages as retryable", () => {
    //#given
    const error = { message: "Provider is overloaded" }

    //#when
    const result = shouldRetryError(error)

    //#then
    expect(result).toBe(true)
  })

  test("selectFallbackProvider prefers first connected provider in preference order", () => {
    //#given
    writeFileSync(
      join(TEST_CACHE_DIR, "connected-providers.json"),
      JSON.stringify({ connected: ["anthropic", "nvidia"], updatedAt: new Date().toISOString() }, null, 2),
    )

    //#when
    const provider = selectFallbackProvider(["anthropic", "nvidia"], "nvidia")

    //#then
    expect(provider).toBe("anthropic")
  })

  test("selectFallbackProvider falls back to next connected provider when first is disconnected", () => {
    //#given
    writeFileSync(
      join(TEST_CACHE_DIR, "connected-providers.json"),
      JSON.stringify({ connected: ["nvidia"], updatedAt: new Date().toISOString() }, null, 2),
    )

    //#when
    const provider = selectFallbackProvider(["anthropic", "nvidia"])

    //#then
    expect(provider).toBe("nvidia")
  })

  test("selectFallbackProvider uses provider preference order when cache is missing", () => {
    //#given - no cache file

    //#when
    const provider = selectFallbackProvider(["anthropic", "nvidia"], "nvidia")

    //#then
    expect(provider).toBe("anthropic")
  })

  test("shouldRetryError returns false for GitHub Copilot model_not_supported message (not a generic retryable)", () => {
    //#given
    const error = { name: "APIError", message: "The requested model is not supported." }

    //#when
    const result = shouldRetryError(error)

    //#then
    expect(result).toBe(false)
  })

  test("isUnsupportedModelError detects 'not supported' message in message string for 400 errors", () => {
    //#given
    const error = { statusCode: 400, message: "The requested model is not supported." }

    //#when
    const result = isUnsupportedModelError(error)

    //#then
    expect(result).toBe(true)
  })

  test("isUnsupportedModelError detects code in GitHub Copilot responseBody", () => {
    //#given
    const error = {
      name: "APIError",
      data: {
        message: "The requested model is not supported.",
        statusCode: 400,
        responseBody: JSON.stringify({
          error: {
            message: "The requested model is not supported.",
            code: "model_not_supported",
            param: "model",
            type: "invalid_request_error",
          },
        }),
      },
    }

    //#when
    const result = isUnsupportedModelError(error.data)

    //#then
    expect(result).toBe(true)
  })

  test("isUnsupportedModelError returns false for non-model-related errors", () => {
    //#given
    const error = { name: "RateLimitError", message: "Rate limit exceeded" }

    //#when
    const result = isUnsupportedModelError(error)

    //#then
    expect(result).toBe(false)
  })
})
