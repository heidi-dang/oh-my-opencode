import { beforeEach, mock } from "bun:test"
import { _resetForTesting } from "./src/features/claude-code-session-state/state"
import { contextCollector } from "./src/features/context-injector"

beforeEach(() => {
  mock.restore()
  _resetForTesting()
  contextCollector.clearAll()
})
