/**
 * Semantic Trimmer
 * 
 * Extracts signatures (classes, functions, interfaces) from code to provide 
 * high-value context while aggressively reducing token usage.
 */

export class SemanticTrimmer {
  /**
   * Trims a file by keeping only its structural signatures.
   * Falls back to line-based trimming if the language is not supported or extraction fails.
   */
  static trim(filePath: string, content: string, maxLines: number = 50): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return this.trimJS(content, maxLines)
      case 'py':
        return this.trimPython(content, maxLines)
      case 'go':
        return this.trimGo(content, maxLines)
      default:
        // Basic fallback: just return the first maxLines
        return content.split('\n').slice(0, maxLines).join('\n')
    }
  }

  private static trimJS(content: string, maxLines: number): string {
    const lines = content.split('\n')
    const result: string[] = []
    let currentLines = 0

    // Patterns for signatures
    const signatureRegex = /^\s*(export\s+)?(async\s+)?(function|class|interface|type|const|let|enum)\b/

    for (const line of lines) {
      if (signatureRegex.test(line) || line.trim().startsWith('@')) {
        result.push(line)
        currentLines++
      } else if (line.trim() === '}' || line.trim() === '};') {
        // Keep closing braces for structure if they are at the top level (approximate)
        if (!line.startsWith(' ')) {
           result.push(line)
           currentLines++
        }
      }

      if (currentLines >= maxLines) break
    }

    if (result.length === 0) return lines.slice(0, maxLines).join('\n')
    
    return result.join('\n') + `\n// ... [Implementation details hidden, ${lines.length - result.length} lines omitted]`
  }

  private static trimPython(content: string, maxLines: number): string {
    const lines = content.split('\n')
    const result: string[] = []
    let currentLines = 0

    const signatureRegex = /^\s*(async\s+)?(def|class)\b/

    for (const line of lines) {
      if (signatureRegex.test(line) || line.trim().startsWith('@')) {
        result.push(line)
        currentLines++
      }

      if (currentLines >= maxLines) break
    }

    if (result.length === 0) return lines.slice(0, maxLines).join('\n')

    return result.join('\n') + `\n# ... [Implementation details hidden, ${lines.length - result.length} lines omitted]`
  }

  private static trimGo(content: string, maxLines: number): string {
    const lines = content.split('\n')
    const result: string[] = []
    let currentLines = 0

    const signatureRegex = /^\s*(func|type|interface|struct)\b/

    for (const line of lines) {
      if (signatureRegex.test(line) || line.startsWith('package ') || line.startsWith('import ')) {
        result.push(line)
        currentLines++
      }

      if (currentLines >= maxLines) break
    }

    if (result.length === 0) return lines.slice(0, maxLines).join('\n')

    return result.join('\n') + `\n// ... [Implementation details hidden, ${lines.length - result.length} lines omitted]`
  }
}
