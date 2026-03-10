import { Database } from "bun:sqlite"
import { join } from "node:path"
import { existsSync, mkdirSync } from "node:fs"
import { getOpenCodeConfigDir } from "./opencode-config-dir"
import { log } from "./logger"
import { vectorize, buildVocabulary } from "./vector-utils"

export interface MemoryItem {
  id?: number
  category: string
  content: string
  tags: string
  metadata?: string
  embeddings?: Buffer | string
  timestamp?: string
  similarity?: number
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
        embeddings BLOB,
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
        embeddings BLOB,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, id)
      );
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags)`)
  }

  public save(item: MemoryItem): number {
    const query = this.db.prepare(`
      INSERT INTO memories (category, content, tags, metadata, embeddings)
      VALUES ($category, $content, $tags, $metadata, $embeddings)
    `)
    
    // Auto-vectorize if not provided (simple TF-baseline)
    const embeddingsStr = typeof item.embeddings === 'string' 
      ? item.embeddings 
      : JSON.stringify(vectorize(item.content, buildVocabulary([item.content])))

    const result = query.run({
      $category: item.category,
      $content: item.content,
      $tags: item.tags,
      $metadata: item.metadata || null,
      $embeddings: Buffer.from(embeddingsStr)
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

  public semanticQuery(vector: number[], limit: number = 5): MemoryItem[] {
    const all = this.db.prepare(`SELECT * FROM memories WHERE embeddings IS NOT NULL`).all() as any[]
    
    const scored = all.map(item => {
      const itemVector = JSON.parse(item.embeddings.toString())
      const similarity = this.calculateSimilarity(vector, itemVector)
      return { ...item, similarity }
    })

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  private calculateSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let mA = 0
    let mB = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i]
      mA += a[i] * a[i]
      mB += b[i] * b[i]
    }
    mA = Math.sqrt(mA)
    mB = Math.sqrt(mB)
    if (mA === 0 || mB === 0) return 0
    return dotProduct / (mA * mB)
  }

  public delete(id: number) {
    this.db.run(`DELETE FROM memories WHERE id = ?`, [id])
  }

  public close() {
    this.db.close()
  }
}

export const memoryDB = MemoryDB.getInstance()
