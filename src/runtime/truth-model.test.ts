import { describe, expect, test, beforeEach } from "bun:test"
import { ledger } from "./state-ledger"
import { createQueryLedgerTool } from "./tools/query-ledger"
import { createCompleteTaskTool } from "./tools/complete-task"

describe("Truth Model Live Wiring Evidence", () => {
    beforeEach(() => {
        // Reset the ledger
        ledger.clear()
    })

    test("query_ledger and complete_task MUST return verified current-session entries", async () => {
        // 1. Simulate a successful, verified state change from the CURRENT session
        ledger.record("git.push", "origin", true, true, true, "Success", {}, "session-123")

        const queryLedger = createQueryLedgerTool()
        const completeTask = createCompleteTaskTool()

        // 2. Query Ledger in exact same session
        const queryMetadata: any = {}
        const queryResult = await queryLedger.execute({}, { sessionID: "session-123", metadata: (meta: any) => Object.assign(queryMetadata, meta) })

        // 3. Complete Task in exact same session
        const completeMetadata: any = {}
        const completeResult = await completeTask.execute({ message: "All done" }, { sessionID: "session-123", metadata: (meta: any) => Object.assign(completeMetadata, meta) })

        // 4. Assertions on Success Flow
        expect(queryResult).toContain("git.push")
        expect(JSON.parse(queryResult as string).length).toBe(1)
        expect(queryMetadata.metadata.success).toBe(true)
        expect(queryMetadata.metadata.verified).toBe(true)

        expect(completeResult).toContain("TASK COMPLETE")
        expect(completeResult).toContain("[git.push] origin")
        expect(completeMetadata.metadata.success).toBe(true)
        expect(completeMetadata.metadata.sessionID).toBe("session-123")
        expect(completeMetadata.metadata.entries).toBe(1)
    })

    test("query_ledger and complete_task MUST exclude stale, unverified, failed, or wrong-session entries", async () => {
        // 1. Simulate poisoned ledger state
        ledger.record("file.write", "/stale", true, true, true, "Old session", {}, "session-OLD-999") // Wrong session (stale)
        ledger.record("git.commit", "HEAD", false, true, false, "Failed commit", {}, "session-123") // Failed execution
        ledger.record("file.delete", "/src", true, false, true, "Unverified delete", {}, "session-123") // Unverified hallucination risk

        const queryLedger = createQueryLedgerTool()
        const completeTask = createCompleteTaskTool()

        // 2. Query Ledger in current active session
        const queryMetadata: any = {}
        const queryResult = await queryLedger.execute({}, { sessionID: "session-123", metadata: (meta: any) => Object.assign(queryMetadata, meta) })

        // 3. Complete Task in current active session 
        const completeMetadata: any = {}
        const completeResult = await completeTask.execute({}, { sessionID: "session-123", metadata: (meta: any) => Object.assign(completeMetadata, meta) })

        // 4. Assertions on Rejection Flow
        expect(queryResult).toBe("No matching verified actions found in the current completion flow.")
        expect(queryMetadata.metadata.recordCount).toBe(0)

        expect(completeResult).toContain("- No state changes recorded in this session.")
        expect(completeResult).not.toContain("stale")
        expect(completeResult).not.toContain("HEAD")
        expect(completeResult).not.toContain("/src")
        expect(completeMetadata.metadata.entries).toBe(0)
    })
})
