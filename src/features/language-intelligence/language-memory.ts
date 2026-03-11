import { MemoryDB } from "../../shared/memory-db"

export interface LanguageMemoryItem {
  signature: string
  fix: string
}

export class LanguageMemory {
  private db: MemoryDB

  constructor() {
    this.db = MemoryDB.getInstance()
  }

  public saveFix(language: string, signature: string, fix: string): number {
    return this.db.save({
      category: "fix_pattern",
      content: fix,
      tags: language.toLowerCase(),
      metadata: JSON.stringify({ language: language.toLowerCase(), signature })
    })
  }

  public getFixes(language: string): LanguageMemoryItem[] {
    const langLower = language.toLowerCase()
    const records = this.db.query({ category: "fix_pattern" })
    
    return records
      .filter(r => {
        if (r.tags === langLower) return true
        try {
          if (r.metadata) {
            const meta = JSON.parse(r.metadata)
            return meta.language === langLower
          }
        } catch { /* ignore */ }
        return false
      })
      .map(r => {
        let meta: any = {}
        try {
          if (r.metadata) meta = JSON.parse(r.metadata)
        } catch { /* ignore */ }
        
        return {
          signature: meta.signature || "unknown_signature",
          fix: r.content
        }
      })
  }

  public formatForInjection(language: string): string {
    const fixes = this.getFixes(language)
    if (fixes.length === 0) return ""

    const sections = ["### [LANGUAGE MEMORY]\nPrevious successful fixes for similar patterns in this repository:"]
    
    for (const item of fixes) {
      sections.push(`\n#### Pattern: ${item.signature}\n\`\`\`\n${item.fix}\n\`\`\``)
    }

    return sections.join("\n")
  }
}

