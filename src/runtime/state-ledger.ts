/**
 * State Ledger - The source of truth for all verified system state changes.
 * 
 * Agents cannot claim success unless the State Ledger confirms the change.
 * This completely eliminates hallucinated PR URLs, fake push confirmations,
 * and assumed file writes.
 */

export type LedgerEntryType =
    | "file.write"
    | "file.delete"
    | "git.commit"
    | "git.push"
    | "git.pr"
    | "command.execute"
    | "package.install"

export interface LedgerEntry {
    type: LedgerEntryType
    timestamp: number
    key: string      // e.g. file path, commit hash, PR URL, package name
    success: boolean
    verified: boolean
    changedState: boolean
    stdout: string
    sessionID?: string
    metadata?: any   // additional contextual data
}

export class StateLedger {
    private static instance: StateLedger
    private entries: LedgerEntry[] = []

    private constructor() { }

    public static getInstance(): StateLedger {
        if (!StateLedger.instance) {
            StateLedger.instance = new StateLedger()
        }
        return StateLedger.instance
    }

    /**
     * Record a verified state change in the system.
     */
    public record(
        type: LedgerEntryType,
        key: string,
        success: boolean,
        verified: boolean,
        changedState: boolean,
        stdout: string,
        metadata?: any,
        sessionID?: string
    ): void {
        this.entries.push({
            type,
            timestamp: Date.now(),
            key,
            success,
            verified,
            changedState,
            stdout,
            sessionID,
            metadata
        })
    }

    /**
     * Verify if a specific state change has actually occurred in this session.
     */
    public has(type: LedgerEntryType, keyOrCondition: string | ((entry: LedgerEntry) => boolean)): boolean {
        if (typeof keyOrCondition === "string") {
            return this.entries.some(e => e.type === type && e.key === keyOrCondition)
        }
        return this.entries.some(e => e.type === type && keyOrCondition(e))
    }

    /**
     * Get all entries of a specific type.
     */
    public getEntries(type?: LedgerEntryType): LedgerEntry[] {
        if (!type) {
            return [...this.entries]
        }
        return this.entries.filter(e => e.type === type)
    }

    /**
     * Get the total number of state changes.
     */
    public get count(): number {
        return this.entries.length
    }

    /**
     * Clear the ledger (usually for testing or a hard session reset).
     */
    public clear(): void {
        this.entries = []
    }
}

export const ledger = StateLedger.getInstance()
