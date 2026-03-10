import { memoryDB } from "./memory-db";

export interface GraphNode {
  id: string;
  type: "task" | "file" | "agent" | "user" | "insight";
  label: string;
  metadata?: string;
}

export interface GraphEdge {
  from_id: string;
  to_id: string;
  relationship: string;
  metadata?: string;
}

/**
 * Knowledge Graph service for relational memory.
 * Uses the existing MemoryDB SQLite instance.
 */
export class KnowledgeGraph {
  private static instance: KnowledgeGraph;

  private constructor() {
    this.init();
  }

  public static getInstance(): KnowledgeGraph {
    if (!KnowledgeGraph.instance) {
      KnowledgeGraph.instance = new KnowledgeGraph();
    }
    return KnowledgeGraph.instance;
  }

  private init() {
    const db = (memoryDB as any).db;
    db.run(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS graph_edges (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (from_id, to_id, relationship)
      );
    `);
  }

  public addNode(node: GraphNode) {
    const db = (memoryDB as any).db;
    db.run(`
      INSERT OR REPLACE INTO graph_nodes (id, type, label, metadata)
      VALUES (?, ?, ?, ?)
    `, [node.id, node.type, node.label, node.metadata || null]);
  }

  public addEdge(edge: GraphEdge) {
    const db = (memoryDB as any).db;
    db.run(`
      INSERT OR REPLACE INTO graph_edges (from_id, to_id, relationship, metadata)
      VALUES (?, ?, ?, ?)
    `, [edge.from_id, edge.to_id, edge.relationship, edge.metadata || null]);
  }

  public getNeighbors(id: string) {
    const db = (memoryDB as any).db;
    return db.prepare(`
      SELECT n.*, e.relationship 
      FROM graph_nodes n
      JOIN graph_edges e ON (e.to_id = n.id OR e.from_id = n.id)
      WHERE (e.from_id = ? AND e.to_id = n.id) OR (e.to_id = ? AND e.from_id = n.id)
    `).all(id, id);
  }
}

export const knowledgeGraph = KnowledgeGraph.getInstance();
