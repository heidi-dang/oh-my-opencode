/**
 * Context Trimmer
 * 
 * Summarizes large inputs to aggressively reduce token usage.
 */

export interface FileContext {
    path: string
    content: string
}

import { SemanticTrimmer } from "./semantic-trimmer"

export const ContextTrimmer = {
    /**
     * Trims an array of files down to a budget of items and lines.
     * Uses SemanticTrimmer to preserve structure (signatures) while hiding bodies.
     */
    trimFiles: (files: FileContext[], maxFiles: number = 8, maxLinesPerFile: number = 50): string[] => {
        const selectedFiles = files.slice(0, maxFiles)

        return selectedFiles.map(f => {
            const trimmedContent = SemanticTrimmer.trim(f.path, f.content, maxLinesPerFile)
            return `// File: ${f.path}\n${trimmedContent}`
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
