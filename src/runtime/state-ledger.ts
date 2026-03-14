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
    private lastFlowStartTimeMap = new Map<string, number>()

    private constructor() { }

    public static getInstance(): StateLedger {
        if (!StateLedger.instance) {
            StateLedger.instance = new StateLedger()
        }
        return StateLedger.instance
    }

    /**
    /**
     * Mark the absolute start of a new completion flow for a specific session.
     * All entries recorded before this timestamp will be ignored by has().
     */
    public startNewFlow(sessionID?: string): void {
        const key = sessionID || "default"
        this.lastFlowStartTimeMap.set(key, Date.now())
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
     * Verify if a specific state change has actually occurred in the current flow of a session.
     */
    public has(type: LedgerEntryType, keyOrCondition: string | ((entry: LedgerEntry) => boolean), sessionID?: string): boolean {
        const key = sessionID || "default"
        const startTime = this.lastFlowStartTimeMap.get(key) || 0
        const flowEntries = this.entries.filter(e => e.timestamp >= startTime && (!sessionID || e.sessionID === sessionID))

        if (typeof keyOrCondition === "string") {
            return flowEntries.some(e => e.type === type && e.key === keyOrCondition)
        }
        return flowEntries.some(e => e.type === type && keyOrCondition(e))
    }

    /**
     * Get all entries, optionally filtered by type and sessionID(s).
     */
    public getEntries(type?: LedgerEntryType, sessionID?: string | string[]): LedgerEntry[] {
        return this.entries.filter(e => {
            const typeMatch = !type || e.type === type
            let sessionMatch = true
            if (sessionID) {
                if (Array.isArray(sessionID)) {
                    sessionMatch = e.sessionID ? sessionID.includes(e.sessionID) : false
                } else {
                    sessionMatch = e.sessionID === sessionID
                }
            }
            return typeMatch && sessionMatch
        })
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
        this.lastFlowStartTimeMap.clear()
    }

    /**
     * Clear all ledger entries for a specific session to prevent memory leaks.
     */
    public clearSession(sessionID: string): void {
        this.entries = this.entries.filter(e => e.sessionID !== sessionID)
        this.lastFlowStartTimeMap.delete(sessionID)
        // Also clean up any entries that don't have a sessionID if the main session dies?
        // No, keep global entries, just prune the session-specific ones.
    }
}

export const ledger = StateLedger.getInstance()
