import { beforeEach, describe, expect, it, vi } from "bun:test"
import { createOptimizedLanguageIntelligenceHook } from "./optimized-language-intelligence-hook"
import { detectLanguage } from "./language-detector"
import { routeLanguage, formatFailureContext } from "./language-router"
import { RepoExampleExtractor } from "./repo-example-extractor"
import { LanguageMemory } from "./language-memory"

vi.mock("./language-detector", () => ({
  detectLanguage: vi.fn(),
}))

vi.mock("./language-router", () => ({
  routeLanguage: vi.fn(),
  formatLanguageContext: vi.fn(() => "mocked-context"),
  formatFailureContext: vi.fn(() => "mocked-failure"),
}))

vi.mock("./repo-example-extractor", () => ({
  RepoExampleExtractor: vi.fn().mockImplementation(() => ({
    extractIfNeeded: vi.fn().mockResolvedValue(undefined),
    formatForInjection: vi.fn(() => "repo-examples"),
  })),
}))

vi.mock("./language-memory", () => ({
  LanguageMemory: vi.fn().mockImplementation(() => ({
    formatForInjection: vi.fn(() => "memory-context"),
  })),
}))

vi.mock("../../shared/logger", () => ({
  log: vi.fn(),
}))

describe("Optimized Language Intelligence Hook", () => {
  let collector: { register: ReturnType<typeof vi.fn> }
  let hook: ReturnType<typeof createOptimizedLanguageIntelligenceHook>

  beforeEach(() => {
    vi.clearAllMocks()
    collector = { register: vi.fn() }
    hook = createOptimizedLanguageIntelligenceHook({
      collector: collector as any,
      directory: "/mock/dir",
    })
  })

  it("preserves the baseline language context contract on chat.message", async () => {
    ;(detectLanguage as any).mockResolvedValue({
      primary: "typescript",
      confidence: 1,
      secondary: [],
      indicators: [],
    })
    ;(routeLanguage as any).mockReturnValue({
      pack: { language: "typescript" },
      stepbook: { id: "test-stepbook" },
      taskClass: "refactor",
    })

    await hook["chat.message"](
      { sessionID: "test-session" },
      { parts: [{ type: "text", text: "Refactor this module" }] }
    )

    expect(detectLanguage).toHaveBeenCalledWith("/mock/dir")
    expect(RepoExampleExtractor).toHaveBeenCalledWith("/mock/dir")
    expect(LanguageMemory).toHaveBeenCalled()
    expect(collector.register).toHaveBeenCalledWith(
      "test-session",
      expect.objectContaining({
        id: "language-intelligence",
        source: "custom",
        priority: "high",
        persistent: true,
        content: expect.stringContaining("mocked-context"),
        metadata: {
          type: "language-intelligence",
          language: "typescript",
          taskClass: "refactor",
          stepbook: "test-stepbook",
        },
      })
    )

    const registeredContext = collector.register.mock.calls[0]?.[1]?.content
    expect(registeredContext).toContain("repo-examples")
    expect(registeredContext).toContain("memory-context")
  })

  it("registers failure diagnosis for command tool failures", async () => {
    ;(detectLanguage as any).mockResolvedValue({
      primary: "typescript",
      confidence: 1,
      secondary: [],
      indicators: [],
    })
    ;(routeLanguage as any).mockReturnValue({
      pack: { language: "typescript" },
      stepbook: null,
      taskClass: null,
    })
    ;(formatFailureContext as any).mockReturnValue("diagnosed failure")

    await hook["chat.message"](
      { sessionID: "sess-1" },
      { parts: [{ type: "text", text: "Investigate the build failure" }] }
    )

    await hook["tool.execute.after"](
      { tool: "bash", sessionID: "sess-1", callID: "call-1" },
      { title: "bash", output: "tsc failed", metadata: {} }
    )

    expect(formatFailureContext).toHaveBeenCalledWith(
      { language: "typescript" },
      "tsc failed"
    )
    expect(collector.register).toHaveBeenLastCalledWith(
      "sess-1",
      expect.objectContaining({
        id: "failure-diagnosis-call-1",
        source: "custom",
        priority: "critical",
        persistent: false,
        content: "diagnosed failure",
        metadata: { type: "failure-diagnosis", tool: "bash" },
      })
    )
  })
})
