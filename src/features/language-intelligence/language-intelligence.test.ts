
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createLanguageIntelligenceHook } from "./language-intelligence-hook"
import { detectLanguage } from "./language-detector"
import { routeLanguage } from "./language-router"

// Mock the dependencies
vi.mock("./language-detector", () => ({
  detectLanguage: vi.fn(),
}))

vi.mock("./language-router", () => ({
  routeLanguage: vi.fn(),
  formatLanguageContext: vi.fn(() => "mocked-context"),
  formatFailureContext: vi.fn(),
}))

vi.mock("../../shared/logger", () => ({
  log: vi.fn(),
}))

describe("Language Intelligence Integration", () => {
  let collector: any
  let hook: any

  beforeEach(() => {
    collector = {
      register: vi.fn(),
    }
    hook = createLanguageIntelligenceHook({
      collector,
      directory: "/mock/dir",
    })
    vi.clearAllMocks()
  })

  it("should detect language and register context on chat.message", async () => {
    const mockProfile = { primary: "typescript", confidence: 1.0, secondary: [], indicators: [] }
    const mockRoute = { pack: { language: "typescript" }, stepbook: { id: "test-sb" }, taskClass: "refactor" }
    
    ;(detectLanguage as any).mockResolvedValue(mockProfile)
    ;(routeLanguage as any).mockReturnValue(mockRoute)

    const input = { sessionID: "test-session" }
    const output = { parts: [{ type: "text", text: "Refactor this code" }] }

    await hook["chat.message"](input, output)

    expect(detectLanguage).toHaveBeenCalledWith("/mock/dir")
    expect(routeLanguage).toHaveBeenCalled()
    expect(collector.register).toHaveBeenCalledWith("test-session", expect.objectContaining({
      id: "language-intelligence",
      priority: "high"
    }))
  })

  it("should provide failure diagnosis after a command tool execution", async () => {
    const mockPack = { language: "typescript" }
    const mockProfile = { primary: "typescript", confidence: 1.0, secondary: [], indicators: [] }
    ;(detectLanguage as any).mockResolvedValue(mockProfile)
    ;(routeLanguage as any).mockReturnValue({ pack: mockPack })

    await hook["chat.message"]({ sessionID: "sess-1" }, { parts: [{ type: "text", text: "hi" }] })

    // Now execute tool
    const { formatFailureContext } = await import("./language-router")
    ;(formatFailureContext as any).mockReturnValue("diagnosed-failure")

    const toolInput = { tool: "bash", sessionID: "sess-1", callID: "call-1" }
    const toolOutput = { title: "bash", output: "error: compilation failed", metadata: {} }

    await hook["tool.execute.after"](toolInput, toolOutput)

    expect(formatFailureContext).toHaveBeenCalled()
    expect(collector.register).toHaveBeenCalledWith("sess-1", expect.objectContaining({
      id: "failure-diagnosis-call-1",
      priority: "critical"
    }))
  })
})
