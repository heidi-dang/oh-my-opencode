import { Database } from "bun:sqlite"
import { join } from "node:path"
import { existsSync, mkdirSync } from "node:fs"
import { getOpenCodeConfigDir } from "./opencode-config-dir"
import { log } from "./logger"

export type MemoryCategory =
  | "failure_signature"
  | "fix_pattern"
  | "verification_pattern"
  | "repo_convention"
  | "task_pattern"
  | "agent_hint"

export interface MemoryContextItem {
  id?: number
  category: MemoryCategory
  repo?: string
  language?: string
  task_type?: string
  path_scope?: string[]
  signature?: string
  content: string
  tags: string
  metadata?: string
  evidence?: string[]
  confidence?: number
  last_used_at?: number
  timestamp?: string
}

export interface MemoryQueryParams {
  category?: MemoryCategory
  repo?: string
  language?: string
  task_type?: string
  signature?: string
  tags?: string
  keyword?: string
}

export interface RankedMemoryItem extends MemoryContextItem {
  relevance_score: number
}

/**
 * Normalize tags to a stable, queryable format.
 * Lowercases, trims, deduplicates, and joins with commas.
 */
function normalizeTags(raw: string): string {
  return [...new Set(
    raw
      .toLowerCase()
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0)
  )].join(",")
}

/**
 * Simple string hash for generating stable signatures from content.
 * Not cryptographic — just collision-resistant enough for dedup keys.
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}



/** Categories that should be unique by (category, repo, signature). */
const UPSERT_CATEGORIES: MemoryCategory[] = [
  "failure_signature",
  "fix_pattern",
  "verification_pattern",
  "repo_convention",
]

export class MemoryDB {
  private db: Database
  private static instance: MemoryDB

  private constructor() {
    const configDir = getOpenCodeConfigDir({ binary: "opencode" })
    const dbDir = join(configDir, "memory")
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }
    const dbPath = join(dbDir, "memories.sqlite")

    this.db = new Database(dbPath, { create: true })
    this.db.run("PRAGMA journal_mode = WAL")
    this.db.run("PRAGMA busy_timeout = 5000")
    this.init()
  }

  public static getInstance(): MemoryDB {
    if (!MemoryDB.instance) {
      MemoryDB.instance = new MemoryDB()
    }
    return MemoryDB.instance
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        repo TEXT,
        language TEXT,
        task_type TEXT,
        path_scope TEXT,
        signature TEXT,
        content TEXT NOT NULL,
        tags TEXT,
        metadata TEXT,
        evidence TEXT,
        confidence REAL DEFAULT 1.0,
        last_used_at INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_contexts (
        id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        priority TEXT NOT NULL,
        persistent INTEGER DEFAULT 0,
        registration_order INTEGER,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, source, id)
      );
    `)

    this.migrateSchema()

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_repo ON memories(repo)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_signature ON memories(signature)`)
    this.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_upsert ON memories(category, repo, signature) WHERE signature IS NOT NULL`)
  }

  /**
   * Ensure all expected columns exist. Adds missing columns with safe defaults.
   */
  private migrateSchema(): void {
    const columns = this.db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string }>
    const existingNames = new Set(columns.map(c => c.name))

    const columnDefaults: Record<string, string> = {
      repo: "TEXT",
      language: "TEXT",
      task_type: "TEXT",
      path_scope: "TEXT",
      signature: "TEXT",
      evidence: "TEXT",
      confidence: "REAL DEFAULT 1.0",
      last_used_at: "INTEGER",
    }

    for (const [col, typedef] of Object.entries(columnDefaults)) {
      if (!existingNames.has(col)) {
        log(`[MemoryDB] Migrating: adding column '${col}' to memories table`)
        this.db.run(`ALTER TABLE memories ADD COLUMN ${col} ${typedef}`)
      }
    }

    // Remove legacy embeddings BLOB column data (column stays but we stop using it)
    if (existingNames.has("embeddings")) {
      log("[MemoryDB] Legacy embeddings column detected — data will be ignored")
    }

    this.migrateSessionContextsSchema()
  }

  private migrateSessionContextsSchema(): void {
    const columns = this.db.prepare("PRAGMA table_info(session_contexts)").all() as Array<{
      name: string
      pk: number
    }>

    if (columns.length === 0) return

    const primaryKey = columns
      .filter(column => column.pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map(column => column.name)

    const expectedPrimaryKey = ["session_id", "source", "id"]
    const hasExpectedPrimaryKey =
      primaryKey.length === expectedPrimaryKey.length
      && primaryKey.every((name, index) => name === expectedPrimaryKey[index])

    if (hasExpectedPrimaryKey) return

    log("[MemoryDB] Migrating session_contexts primary key to (session_id, source, id)")

    this.db.run("BEGIN")
    try {
      this.db.run(`
        CREATE TABLE session_contexts_new (
          id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          source TEXT NOT NULL,
          content TEXT NOT NULL,
          priority TEXT NOT NULL,
          persistent INTEGER DEFAULT 0,
          registration_order INTEGER,
          metadata TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (session_id, source, id)
        );
      `)

      this.db.run(`
        INSERT INTO session_contexts_new (
          id, session_id, source, content, priority, persistent, registration_order, metadata, timestamp
        )
        SELECT
          id, session_id, source, content, priority, persistent, registration_order, metadata, timestamp
        FROM session_contexts
      `)

      this.db.run(`DROP TABLE session_contexts`)
      this.db.run(`ALTER TABLE session_contexts_new RENAME TO session_contexts`)
      this.db.run("COMMIT")
    } catch (error) {
      this.db.run("ROLLBACK")
      throw error
    }
  }

  /**
   * Save a memory item. For upsert-eligible categories (failure_signature,
   * fix_pattern, verification_pattern, repo_convention), deduplicates by
   * (category, repo, signature) — updates content/confidence/evidence if found.
   */
  public save(item: MemoryContextItem): number {
    const tags = normalizeTags(item.tags)
    const now = Date.now()

    // Enforce signature for repo_convention to guarantee dedup without mutating caller object
    const effectiveSignature = item.category === "repo_convention" && !item.signature
      ? `convention:${simpleHash(item.content)}`
      : item.signature

    // Upsert path for signature-based categories
    if (
      effectiveSignature &&
      UPSERT_CATEGORIES.includes(item.category)
    ) {
      const existing = this.db.prepare(
        `SELECT id, confidence, evidence FROM memories WHERE category = ? AND signature = ? AND (repo = ? OR (repo IS NULL AND ? IS NULL))`
      ).get(item.category, effectiveSignature, item.repo ?? null, item.repo ?? null) as { id: number; confidence: number; evidence: string | null } | undefined

      if (existing) {
        // Merge evidence arrays (defensive parse for legacy rows)
        let mergedEvidence: string[] = []
        if (existing.evidence) {
          try {
            mergedEvidence = JSON.parse(existing.evidence)
          } catch {
            log(`[MemoryDB] Malformed evidence in row ${existing.id}, starting fresh`)
            mergedEvidence = []
          }
        }
        if (item.evidence) {
          for (const e of item.evidence) {
            if (!mergedEvidence.includes(e)) {
              mergedEvidence.push(e)
            }
          }
        }

        // Keep existing confidence — only verification/use should bump it
        const keepConfidence = existing.confidence ?? item.confidence ?? 0.5

        this.db.prepare(`
          UPDATE memories SET
            content = ?, tags = ?, metadata = ?, evidence = ?,
            confidence = ?, last_used_at = ?,
            language = ?, task_type = ?, path_scope = ?
          WHERE id = ?
        `).run(
          item.content,
          tags,
          item.metadata ?? null,
          JSON.stringify(mergedEvidence),
          keepConfidence,
          now,
          item.language ?? null,
          item.task_type ?? null,
          item.path_scope ? JSON.stringify(item.path_scope) : null,
          existing.id
        )

        log(`[MemoryDB] Upserted memory id=${existing.id} (${item.category}/${effectiveSignature})`)
        return existing.id
      }
    }

    // Insert path
    const result = this.db.prepare(`
      INSERT INTO memories (
        category, repo, language, task_type, path_scope, signature,
        content, tags, metadata, evidence, confidence, last_used_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.category,
      item.repo ?? null,
      item.language ?? null,
      item.task_type ?? null,
      item.path_scope ? JSON.stringify(item.path_scope) : null,
      effectiveSignature ?? null,
      item.content,
      tags,
      item.metadata ?? null,
      item.evidence ? JSON.stringify(item.evidence) : null,
      item.confidence ?? 1.0,
      now
    )

    return result.lastInsertRowid as number
  }

  /**
   * Mark a memory as used (bumps last_used_at for ranking/decay).
   */
  public markUsed(id: number): void {
    this.db.prepare(`UPDATE memories SET last_used_at = ? WHERE id = ?`).run(Date.now(), id)
  }

  /**
   * Query memories with structured filters.
   */
  public query(params: MemoryQueryParams): MemoryContextItem[] {
    let sql = `SELECT * FROM memories WHERE 1=1`
    const args: any[] = []

    if (params.category) {
      sql += ` AND category = ?`
      args.push(params.category)
    }

    if (params.repo) {
      sql += ` AND repo = ?`
      args.push(params.repo)
    }

    if (params.signature) {
      sql += ` AND signature = ?`
      args.push(params.signature)
    }

    if (params.language) {
      sql += ` AND language = ?`
      args.push(params.language)
    }

    if (params.task_type) {
      sql += ` AND task_type = ?`
      args.push(params.task_type)
    }

    if (params.tags) {
      sql += ` AND tags LIKE ? ESCAPE '\\'`
      args.push(`%${params.tags.replace(/[%_\\]/g, '\\$&')}%`)
    }

    if (params.keyword) {
      sql += ` AND content LIKE ? ESCAPE '\\'`
      args.push(`%${params.keyword.replace(/[%_\\]/g, '\\$&')}%`)
    }

    sql += ` ORDER BY confidence DESC, last_used_at DESC, timestamp DESC LIMIT 50`

    const rawResults = this.db.prepare(sql).all(...args) as any[]
    return rawResults.map(row => this.parseRow(row))
  }

  /**
   * Ranked retrieval — queries memories and scores them by relevance to the
   * current context. Results are ordered by composite score, not just recency.
   *
   * Ranking priority:
   *   1. Exact repo match
   *   2. Exact signature match
   *   3. Exact category match
   *   4. Language/task_type match
   *   5. Path overlap
   *   6. Confidence
   *   7. Recency (last_used_at)
   */
  public rankedQuery(
    params: MemoryQueryParams & { path_scope?: string[]; limit?: number }
  ): RankedMemoryItem[] {
    // Broad candidate pool: category-filtered, but allow repo-global fallback
    // Use only category as hard filter; everything else is scored in app code
    const candidates = this.query({
      category: params.category,
      tags: params.tags,
      keyword: params.keyword,
    })

    const now = Date.now()
    const queryKeywords = params.keyword
      ? params.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      : []
    const queryTags = params.tags
      ? normalizeTags(params.tags).split(",")
      : []

    return candidates
      .map(item => {
        let score = 0

        // Repo match (strongest signal)
        if (params.repo && item.repo === params.repo) score += 40
        else if (item.repo && params.repo && item.repo !== params.repo) score -= 25
        // Global (no repo) memory gets a small bonus over mismatched repo
        else if (!item.repo) score += 5

        // Signature match
        if (params.signature && item.signature === params.signature) score += 30
        // Category match
        if (params.category && item.category === params.category) score += 10
        // Language match
        if (params.language && item.language === params.language) score += 5
        // Task type match
        if (params.task_type && item.task_type === params.task_type) score += 5

        // Path overlap — prefix-aware, not exact-match-only
        if (params.path_scope && item.path_scope) {
          for (const queryPath of params.path_scope) {
            for (const itemPath of item.path_scope) {
              if (queryPath === itemPath) {
                score += 6 // exact file match
              } else if (queryPath.startsWith(itemPath + "/") || itemPath.startsWith(queryPath + "/")) {
                score += 3 // same subtree
              } else {
                // Check shared directory prefix
                const queryParts = queryPath.split("/")
                const itemParts = itemPath.split("/")
                let shared = 0
                for (let i = 0; i < Math.min(queryParts.length, itemParts.length); i++) {
                  if (queryParts[i] === itemParts[i]) shared++
                  else break
                }
                if (shared >= 2) score += 1
              }
            }
          }
        }

        // Keyword overlap scoring (content)
        if (queryKeywords.length > 0 && item.content) {
          const contentLower = item.content.toLowerCase()
          let hits = 0
          for (const kw of queryKeywords) {
            if (contentLower.includes(kw)) hits++
          }
          score += (hits / queryKeywords.length) * 15
        }

        // Tag overlap scoring
        if (queryTags.length > 0 && item.tags) {
          const itemTags = item.tags.toLowerCase().split(",").map(t => t.trim())
          let tagHits = 0
          for (const qt of queryTags) {
            if (itemTags.includes(qt)) tagHits++
          }
          score += (tagHits / queryTags.length) * 10
        }

        // Confidence
        score += (item.confidence ?? 0.5) * 10

        // Recency decay (halve score for items older than 7 days without use)
        const age = now - (item.last_used_at ?? 0)
        const daysSinceUse = age / (1000 * 60 * 60 * 24)
        if (daysSinceUse > 7) score *= 0.5
        if (daysSinceUse > 30) score *= 0.5

        return { ...item, relevance_score: score }
      })
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, params.limit ?? 10)
  }

  /**
   * Parse a raw database row into a MemoryContextItem.
   */
  private parseRow(row: any): MemoryContextItem {
    let path_scope: string[] | undefined
    let evidence: string[] | undefined

    try {
      path_scope = row.path_scope ? JSON.parse(row.path_scope) : undefined
    } catch {
      log(`[MemoryDB] Malformed path_scope in row ${row.id}, skipping parse`)
      path_scope = undefined
    }

    try {
      evidence = row.evidence ? JSON.parse(row.evidence) : undefined
    } catch {
      log(`[MemoryDB] Malformed evidence in row ${row.id}, skipping parse`)
      evidence = undefined
    }

    return { ...row, path_scope, evidence }
  }

  public delete(id: number): number {
    const result = this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id)
    return result.changes
  }

  public close() {
    this.db.close()
  }
}

export const memoryDB = MemoryDB.getInstance()
