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
      category: "language_fix",
      content: fix,
      tags: `${language.toLowerCase()},${signature}`,
      metadata: JSON.stringify({ language, signature })
    })
  }

  public getFixes(language: string): LanguageMemoryItem[] {
    const records = this.db.query({ category: "language_fix" })
    
    // Filter down to the requested language
    // tags are stored as "python,TypeMismatch"
    return records
      .filter(r => r.tags?.split(",").includes(language.toLowerCase()))
      .map(r => {
        let meta: any = {}
        try {
          if (r.metadata) meta = JSON.parse(r.metadata)
        } catch { /* ignore */ }
        
        return {
          signature: meta.signature || (r.tags ? r.tags.split(",")[1] : "unknown") || "unknown",
          fix: r.content
        }
      })
  }

  public formatForInjection(language: string): string {
    const fixes = this.getFixes(language)
    if (fixes.length === 0) return ""

    const sections = ["### [LANGUAGE MEMORY]"]
    sections.push(`Previous successful fixes for ${language} in this repository:`)
    
    for (const item of fixes) {
      sections.push(`\n#### Signature: ${item.signature}`)
      sections.push("```")
      sections.push(item.fix)
      sections.push("```")
    }

    return sections.join("\n")
  }
}

