import { Database } from "bun:sqlite"
import { join } from "node:path"
import { existsSync, mkdirSync } from "node:fs"
import { getOpenCodeConfigDir } from "./opencode-config-dir"
import { log } from "./logger"

export interface MemoryItem {
  id?: number
  category: string
  content: string
  tags: string
  metadata?: string
  timestamp?: string
}

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
        content TEXT NOT NULL,
        tags TEXT,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags)`)
  }

  public save(item: MemoryItem): number {
    const query = this.db.prepare(`
      INSERT INTO memories (category, content, tags, metadata)
      VALUES ($category, $content, $tags, $metadata)
    `)
    const result = query.run({
      $category: item.category,
      $content: item.content,
      $tags: item.tags,
      $metadata: item.metadata || null
    })
    return result.lastInsertRowid as number
  }

  public query(params: { category?: string; tags?: string; keyword?: string }): MemoryItem[] {
    let sql = `SELECT * FROM memories WHERE 1=1`
    const args: Record<string, any> = {}

    if (params.category) {
      sql += ` AND category = $category`
      args.$category = params.category
    }

    if (params.tags) {
      // Simple tag matching for now
      sql += ` AND tags LIKE $tags`
      args.$tags = `%${params.tags}%`
    }

    if (params.keyword) {
      sql += ` AND content LIKE $keyword`
      args.$keyword = `%${params.keyword}%`
    }

    sql += ` ORDER BY timestamp DESC LIMIT 50`

    const query = this.db.prepare(sql)
    return query.all(args) as MemoryItem[]
  }

  public delete(id: number) {
    this.db.run(`DELETE FROM memories WHERE id = ?`, [id])
  }

  public close() {
    this.db.close()
  }
}

export const memoryDB = MemoryDB.getInstance()
