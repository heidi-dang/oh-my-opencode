import { contextCollector } from "../context-injector";
import { memoryDB } from "../../shared/memory-db";
import { log } from "../../shared/logger";

/**
 * Feature: Memo Summarizer
 * Automatically distills session context into core memories.
 */
export class MemoSummarizer {
  async summarizeSession(sessionID: string): Promise<void> {
    log(`[MemoSummarizer] Starting session distillation for ${sessionID}`);
    const context = contextCollector.getPending(sessionID);
    
    if (!context.hasContent) {
      log(`[MemoSummarizer] No context to distill for ${sessionID}`);
      return;
    }

    // Grouping entries by source for a logical summary
    const sourceGroups: Record<string, string[]> = {};
    context.entries.forEach(e => {
      sourceGroups[e.source] = sourceGroups[e.source] || [];
      sourceGroups[e.source].push(e.content);
    });

    const summaryContent = Object.entries(sourceGroups)
      .map(([source, contents]) => `### Analysis from ${source}\n${contents.join("\n")}`)
      .join("\n\n---\n\n");

    const memoryID = memoryDB.save({
      category: "agent_hint",
      content: `### Episodic Summary: Session ${sessionID}\n\n${summaryContent}`,
      tags: "episodic, auto-summary",
      metadata: JSON.stringify({
        sessionID,
        timestamp: new Date().toISOString(),
        entryCount: context.entries.length
      })
    });

    log(`[MemoSummarizer] Session ${sessionID} distilled into Memory ID: ${memoryID}`);
  }
}

export const memoSummarizer = new MemoSummarizer();
