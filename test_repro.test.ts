import { test, expect } from "bun:test";
import { resolveModelWithFallback, type ExtendedModelResolutionInput } from "./src/shared/model-resolver";

test("returns uiSelectedModel with override source when provided BEFORE", () => {
      const input: ExtendedModelResolutionInput = {
        uiSelectedModel: "opencode/big-pickle",
        userModel: "anthropic/claude-opus-4-6",
        fallbackChain: [
          { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-6" },
        ],
        availableModels: new Set(["anthropic/claude-opus-4-6", "github-copilot/claude-opus-4-6-preview"]),
        systemDefaultModel: "google/gemini-3.1-pro",
      }
      const result = resolveModelWithFallback(input)
      console.log("BEFORE RESULT:", result)
      expect(result!.model).toBe("opencode/big-pickle")
})
