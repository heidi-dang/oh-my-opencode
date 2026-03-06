import * as fs from "fs"
import * as path from "path"

/**
 * Execution Journal - Deterministic logging of every agent action and result.
 * 
 * This provides replay debugging, anti-hallucination auditing,
 * and high-quality training data generation.
 */

export interface JournalEntry {
    timestamp: string
    sessionID: string
    agent: string
    intent: "execute_tool" | "delegate" | "report" | "verify"
    tool?: string
    args?: any
    stdout?: string
    stderr?: string
    verificationState?: boolean
}

export class ExecutionJournal {
    private static instance: ExecutionJournal
    private journalPath: string
    private stream: fs.WriteStream | null = null

    private constructor() {
        // Default to the working directory's .runtime/journal folder
        const dir = path.join(process.cwd(), ".runtime", "journal")
        this.journalPath = path.join(dir, "execution.jsonl")

        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            this.stream = fs.createWriteStream(this.journalPath, { flags: 'a' })
        } catch (err) {
            console.warn("[ExecutionJournal] Failed to initialize journal file:", err)
        }
    }

    public static getInstance(): ExecutionJournal {
        if (!ExecutionJournal.instance) {
            ExecutionJournal.instance = new ExecutionJournal()
        }
        return ExecutionJournal.instance
    }

    /**
     * Append directly to the JSONL format journal.
     */
    public log(entry: Omit<JournalEntry, "timestamp">): void {
        if (!this.stream) return

        const fullEntry: JournalEntry = {
            timestamp: new Date().toISOString(),
            ...entry
        }

        try {
            this.stream.write(JSON.stringify(fullEntry) + "\n")
        } catch (err) {
            console.warn("[ExecutionJournal] Failed to write entry:", err)
        }
    }

    /**
     * Close the journal stream cleanly.
     */
    public close(): void {
        if (this.stream) {
            this.stream.close()
            this.stream = null
        }
    }
}

export const journal = ExecutionJournal.getInstance()
