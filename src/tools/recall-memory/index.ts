import { tool, type ToolDefinition, type ToolContext } from "@opencode-ai/plugin/tool";
import { contextCollector } from "../../features/context-injector";
import { memoryDB } from "../../shared/memory-db";
import { createSuccessResult, createFailureResult } from "../../utils/safety-tool-result";

interface RecallArgs {
  query?: string;
  limit?: number;
}

export function createRecallMemoryTool(): ToolDefinition {
  return tool({
    description: "Recalls pending context and recorded memories for the current session. Can search by keyword if a query is provided.",
    args: {
      query: tool.schema.string().optional().describe("Optional keyword query to find related memories."),
      limit: tool.schema.number().optional().describe("Number of relevant memories to return (default: 5).")
    },
    execute: async (args: RecallArgs, context: ToolContext) => {
      try {
        const sessionID = context.sessionID;
        if (!sessionID) {
          throw new Error("No active sessionID in tool context.");
        }

        const pending = contextCollector.getPending(sessionID);
        let memories: any[] = [];

        if (args.query) {
          // Structured ranked retrieval (replaces broken semantic search)
          memories = memoryDB.rankedQuery({ keyword: args.query }).slice(0, args.limit || 5);
          // Mark used for ranking decay
          for (const m of memories) {
            if (m.id) memoryDB.markUsed(m.id);
          }
        } else {
          memories = memoryDB.query({});
        }

        const result = createSuccessResult({
          verified: true,
          changedState: false,
          message: `Recalled ${pending.entries.length} context entries and ${memories.length} relevant memories.`
        });

        context.metadata({
          title: "Memory recalled",
          metadata: {
            sessionEntries: pending.entries.length,
            memoryCount: memories.length,
            ...result
          }
        });

        // Return a readable string for the agent
        return `### Recalled Context (${pending.entries.length} entries)\n` + 
               pending.merged + 
               `\n\n### Relevant Memories (${memories.length} results)\n` +
               memories.map(m => `[Memory #${m.id}] ${m.content}`).join("\n\n");

      } catch (err: any) {
        const failure = createFailureResult(err.message);
        context.metadata({
          title: "Recall Memory error",
          ...failure
        });
        return `Error recalling memory: ${err.message}`;
      }
    }
  });
}
