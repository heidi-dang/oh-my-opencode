import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { memoryDB } from "../../shared/memory-db"
import { withToolContract } from "../../utils/tool-contract-wrapper"

export function createMemoryBankTools(): Record<string, ToolDefinition> {
  const memo_save: ToolDefinition = tool({
    description: "Save a new knowledge item or project memory to the persistent memory bank. Use this for architectural patterns, project-specific gotchas, or complex research results.",
    args: {
      category: tool.schema.enum(["architecture", "research", "config", "gotcha", "other"]).describe("Category of the memory"),
      content: tool.schema.string().describe("The actual memory content or insight to stash"),
      tags: tool.schema.string().describe("Comma-separated tags for indexing (e.g. 'auth, redis, performance')"),
      metadata: tool.schema.string().optional().describe("Optional JSON string or additional context for this memory")
    },
    execute: withToolContract("memo_save", async (args: { category: string; content: string; tags: string; metadata?: string }, context) => {
      const id = memoryDB.save({ 
        category: args.category, 
        content: args.content, 
        tags: args.tags, 
        metadata: args.metadata 
      })
      const output = `Memory successfully stashed in the bank (ID: ${id}). Agents in future sessions will be able to retrieve this insight.`
      context.metadata({
        title: "Memory Saved",
        success: true,
        verified: true,
        output
      })
      return output
    })
  })

  const memo_query: ToolDefinition = tool({
    description: "Search for existing memories in the bank by keyword, category, or tags.",
    args: {
      keyword: tool.schema.string().optional().describe("Search keyword to match against content"),
      category: tool.schema.enum(["architecture", "research", "config", "gotcha", "other"]).optional().describe("Filter by category"),
      tags: tool.schema.string().optional().describe("Filter by specific tags")
    },
    execute: withToolContract("memo_query", async (args: { keyword?: string; category?: string; tags?: string }, context) => {
      const results = memoryDB.query({ 
        keyword: args.keyword, 
        category: args.category, 
        tags: args.tags 
      })
      
      if (results.length === 0) {
        const output = "No matching memories found in the bank."
        context.metadata({
          title: "Memory Query",
          success: true,
          verified: true,
          output
        })
        return output
      }

      const formatted = results.map(r => `[ID: ${r.id}] [${r.category}] [Tags: ${r.tags}] (${r.timestamp})\n${r.content}`).join("\n\n---\n\n")
      const output = `Found ${results.length} memories:\n\n${formatted}`
      
      context.metadata({
        title: "Memory Query Results",
        success: true,
        verified: true,
        count: results.length
      })
      
      return output
    })
  })

  const memo_forget: ToolDefinition = tool({
    description: "Remove a memory from the bank if it is obsolete or incorrect.",
    args: {
      id: tool.schema.number().describe("The ID of the memory to remove")
    },
    execute: withToolContract("memo_forget", async (args: { id: number }, context) => {
      memoryDB.delete(args.id)
      const output = `Memory ${args.id} has been removed from the bank.`
      context.metadata({
        title: "Memory Forgotten",
        success: true,
        verified: true,
        output
      })
      return output
    })
  })

  return { memo_save, memo_query, memo_forget }
}
