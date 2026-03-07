import { describe, test, expect, spyOn, beforeEach } from "bun:test"
import { createFsSafeTool } from "./fs-safe"
import * as metadataStore from "../../features/tool-metadata-store/store"

describe("fs_safe Tool Contract", () => {
    let tool: any
    let mockContext: any

    beforeEach(() => {
        tool = createFsSafeTool()
        const mockMetadata = {
            metadata: () => {}
        }
        mockContext = {
            directory: "/tmp",
            sessionID: "test-session",
            callID: "call-123",
            metadata: spyOn(mockMetadata, "metadata"),
        }
        spyOn(metadataStore, "storeToolMetadata").mockImplementation(() => {})
    })

    test("should call storeToolMetadata with success and verified booleans", async () => {
        const args = {
            operation: "write",
            filePath: "test.txt",
            content: "hello"
        }

        await tool.execute(args, mockContext)

        // Check metadataStore.storeToolMetadata call
        expect(metadataStore.storeToolMetadata).toHaveBeenCalled()
        const callArgs = (metadataStore.storeToolMetadata as any).mock.calls[0]
        expect(callArgs[0]).toBe("test-session")
        expect(callArgs[1]).toBe("call-123")
        expect(callArgs[2].metadata.success).toBe(true)
        expect(callArgs[2].metadata.verified).toBe(true)
    })

    test("should include changedState in metadata", async () => {
        const args = {
            operation: "write",
            filePath: "test-state.txt",
            content: "state"
        }

        await tool.execute(args, mockContext)

        const callArgs = (metadataStore.storeToolMetadata as any).mock.calls[0]
        expect(callArgs[2].metadata.changedState).toBe(true)
    })

    test("should call storeToolMetadata on failure", async () => {
        // Trigger a real error by passing null for filePath which will throw in path.resolve
        const args = {
            operation: "write",
            filePath: null as any,
            content: "fail"
        }

        await tool.execute(args, mockContext)

        const calls = (metadataStore.storeToolMetadata as any).mock.calls
        console.log("ALL TITLES:", calls.map((c: any) => c[2].title))
        
        const callArgs = calls.find(
            (call: any) => call[2].title.toLowerCase().includes("error")
        )
        expect(callArgs).toBeDefined()
        expect(callArgs[2].metadata.success).toBe(false)
        expect(callArgs[2].metadata.verified).toBe(false)
    })
})
