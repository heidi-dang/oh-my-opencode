import { describe, it, expect, beforeEach } from "bun:test"
import { ledger } from "./state-ledger"

describe("StateLedger Session Isolation", () => {
    beforeEach(() => {
        ledger.clear()
    })

    it("should isolate flow start times between sessions", async () => {
        const sessionA = "session-a"
        const sessionB = "session-b"

        // 1. Session A starts flow and records an entry
        ledger.startNewFlow(sessionA)
        await new Promise(resolve => setTimeout(resolve, 10))
        ledger.record("git.commit", "feat: a", true, true, true, "done", {}, sessionA)

        // 2. Session B starts flow MUCH later
        await new Promise(resolve => setTimeout(resolve, 50))
        ledger.startNewFlow(sessionB)
        
        // 3. Verify Session A still sees its entry (it was after its own start time)
        expect(ledger.has("git.commit", "feat: a", sessionA)).toBe(true)

        // 4. Verify Session B does NOT see Session A's entry (it was before session B's start time)
        expect(ledger.has("git.commit", "feat: a", sessionB)).toBe(false)
    })

    it("should isolate entries by sessionID in has()", () => {
        const sessionA = "session-a"
        const sessionB = "session-b"

        ledger.startNewFlow(sessionA)
        ledger.startNewFlow(sessionB)

        ledger.record("git.commit", "feat: b", true, true, true, "done", {}, sessionB)

        expect(ledger.has("git.commit", "feat: b", sessionB)).toBe(true)
        expect(ledger.has("git.commit", "feat: b", sessionA)).toBe(false)
    })

    it("should filter getEntries by sessionID", () => {
        ledger.record("git.commit", "a", true, true, true, "done", {}, "session-a")
        ledger.record("git.commit", "b", true, true, true, "done", {}, "session-b")
        ledger.record("git.push", "c", true, true, true, "done", {}, "session-a")

        expect(ledger.getEntries(undefined, "session-a").length).toBe(2)
        expect(ledger.getEntries(undefined, "session-b").length).toBe(1)
        expect(ledger.getEntries("git.push", "session-a").length).toBe(1)
        expect(ledger.getEntries("git.push", "session-b").length).toBe(0)
    })

    it("should support multiple sessionIDs in getEntries", () => {
        ledger.record("git.commit", "a", true, true, true, "done", {}, "session-a")
        ledger.record("git.commit", "b", true, true, true, "done", {}, "session-b")
        ledger.record("git.commit", "c", true, true, true, "done", {}, "session-c")

        const entries = ledger.getEntries(undefined, ["session-a", "session-c"])
        expect(entries.length).toBe(2)
        expect(entries.map(e => e.sessionID)).toContain("session-a")
        expect(entries.map(e => e.sessionID)).toContain("session-c")
        expect(entries.map(e => e.sessionID)).not.toContain("session-b")
    })
})
