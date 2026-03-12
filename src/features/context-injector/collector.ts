import { memoryDB } from "../../shared/memory-db";
import type {
  ContextEntry,
  ContextPriority,
  PendingContext,
  RegisterContextOptions,
} from "./types";

const CONTEXT_SEPARATOR = "\n\n---\n\n";

/** Lock for serializing DB access to prevent SQLITE_BUSY */
let dbLock = false;
const dbLockQueue: (() => void)[] = [];

function withLock<T>(fn: () => T): T {
  if (!dbLock) {
    dbLock = true;
    try {
      return fn();
    } finally {
      dbLock = false;
      const next = dbLockQueue.shift();
      if (next) next();
    }
  }
  const result = fn();
  return result;
}

export class ContextCollector {
  private get db() {
    return (memoryDB as any).db;
  }

  register(sessionID: string, options: RegisterContextOptions): void {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO session_contexts 
      (id, session_id, source, content, priority, persistent, registration_order, metadata)
      VALUES ($id, $session_id, $source, $content, $priority, $persistent, 
              (SELECT COALESCE(MAX(registration_order), 0) + 1 FROM session_contexts), $metadata)
    `);

    query.run({
      $id: options.id,
      $session_id: sessionID,
      $source: options.source,
      $content: options.content,
      $priority: options.priority ?? "normal",
      $persistent: options.persistent ? 1 : 0,
      $metadata: options.metadata || null
    });
  }

  get(sessionID: string, contextID: string): ContextEntry | undefined {
    const row = this.db.prepare(`
      SELECT * FROM session_contexts 
      WHERE session_id = ? AND id = ?
    `).get(sessionID, contextID) as any;

    if (!row) return undefined;

    return {
      id: row.id,
      source: row.source,
      content: row.content,
      priority: row.priority as ContextPriority,
      registrationOrder: row.registration_order,
      metadata: row.metadata,
      persistent: row.persistent === 1
    };
  }

  getPending(sessionID: string): PendingContext {
    const rows = this.db.prepare(`
      SELECT * FROM session_contexts 
      WHERE session_id = ? 
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 0 
          WHEN 'high' THEN 1 
          WHEN 'normal' THEN 2 
          WHEN 'low' THEN 3 
        END, registration_order ASC
    `).all(sessionID) as any[];

    if (rows.length === 0) {
      return { merged: "", entries: [], hasContent: false };
    }

    const entries: ContextEntry[] = rows.map(row => ({
      id: row.id,
      source: row.source,
      content: row.content,
      priority: row.priority as ContextPriority,
      registrationOrder: row.registration_order,
      metadata: row.metadata,
      persistent: row.persistent === 1
    }));

    const merged = entries.map(e => e.content).join(CONTEXT_SEPARATOR);

    return {
      merged,
      entries,
      hasContent: entries.length > 0,
    };
  }

  consume(sessionID: string): PendingContext {
    const pending = this.getPending(sessionID);
    this.clearNonPersistent(sessionID);
    return pending;
  }

  clearNonPersistent(sessionID: string): void {
    this.db.run(`DELETE FROM session_contexts WHERE session_id = ? AND persistent = 0`, [sessionID]);
  }

  clearSession(sessionID: string): void {
    this.db.run(`DELETE FROM session_contexts WHERE session_id = ?`, [sessionID]);
  }

  clearAll(): void {
    this.db.run(`DELETE FROM session_contexts`);
  }

  hasPending(sessionID: string): boolean {
    return withLock(() => {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM session_contexts WHERE session_id = ?`).get(sessionID) as any;
      return result.count > 0;
    });
  }

  hasNonPersistentPending(sessionID: string): boolean {
    return withLock(() => {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM session_contexts WHERE session_id = ? AND persistent = 0`).get(sessionID) as any;
      return result.count > 0;
    });
  }
}

export const contextCollector = new ContextCollector();
