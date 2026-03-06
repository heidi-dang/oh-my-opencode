import { ledger } from "../../runtime/state-ledger"

/**
 * State Ledger
 * 
 * Formalized schema for deterministic state tracking.
 */

export interface LedgerEntry {
    type: string
    key: string
    timestamp: number
    success: boolean
    verified: boolean
    changedState: boolean
    stdout: string
    stderr: string
}

// Singleton ledger for the current session
export const stateLedger = {
    entries: [] as LedgerEntry[],

    push: (entry: Omit<LedgerEntry, 'timestamp'>) => {
        stateLedger.entries.push({
            ...entry,
            timestamp: Date.now()
        })
    },

    getEntries: () => [...stateLedger.entries]
}
