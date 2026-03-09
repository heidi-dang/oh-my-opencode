/**
 * ResultCompactor
 * 
 * Summarizes large stdout/stderr outputs to keep the conversation context lean.
 */
export function compactResult(text: string, maxLength: number = 2000): string {
    if (!text || text.length <= maxLength) return text

    const lines = text.split("\n")
    if (lines.length < 20) {
        return text.substring(0, maxLength) + "\n... [TRUNCATED]"
    }

    // Keep first 10 and last 10 lines
    const head = lines.slice(0, 10).join("\n")
    const tail = lines.slice(-10).join("\n")
    const middleCount = lines.length - 20

    return `${head}\n\n... [${middleCount} lines omitted] ...\n\n${tail}`
}

/**
 * Summarizes a tool output for internal bypass logging.
 */
export function summarizeOutput(tool: string, output: string): string {
    const compact = compactResult(output, 500)
    return `[Auto-Executed: ${tool}]\n${compact}`
}
