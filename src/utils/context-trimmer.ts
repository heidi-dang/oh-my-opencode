/**
 * Context Trimmer
 * 
 * Summarizes large inputs to aggressively reduce token usage.
 */

export interface FileContext {
    path: string
    content: string
}

export const ContextTrimmer = {
    /**
     * Trims an array of files down to a budget of items and lines.
     * If a file is too large, it summarizes its top section only, 
     * assuming that's where imports and class definitions reside.
     */
    trimFiles: (files: FileContext[], maxFiles: number = 8, maxLinesPerFile: number = 20): string[] => {
        const selectedFiles = files.slice(0, maxFiles)

        return selectedFiles.map(f => {
            const lines = f.content.split('\n')
            if (lines.length <= maxLinesPerFile) {
                return `// File: ${f.path}\n${f.content}`
            }

            const summary = lines.slice(0, maxLinesPerFile).join('\n')
            return `// File: ${f.path} (TRUNCATED - showing first ${maxLinesPerFile} lines of ${lines.length})\n${summary}\n// ... [${lines.length - maxLinesPerFile} lines omitted]`
        })
    },

    /**
     * Summarizes generic text outputs (like git diffs or test logs) to prevent token bloat.
     */
    trimOutput: (output: string, maxLength: number = 2000): string => {
        if (output.length <= maxLength) return output;

        // For large logs, keeping the beginning and end is usually more useful than just the beginning
        const half = Math.floor(maxLength / 2) - 30;
        return `${output.substring(0, half)}\n\n... [TRUNCATED ${output.length - maxLength} chars] ...\n\n${output.substring(output.length - half)}`
    }
}
