import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export interface PRState {
    url?: string
    number?: number
    status?: "open" | "merged" | "closed"
    updatedAt: string
}

const STORAGE_DIR = join(homedir(), ".local", "share", "oh-my-opencode")
const STORAGE_FILE = join(STORAGE_DIR, "pr-state.json")

let state: Record<string, PRState> = {}

export function loadPRState() {
    try {
        if (existsSync(STORAGE_FILE)) {
            state = JSON.parse(readFileSync(STORAGE_FILE, "utf-8"))
        }
    } catch (e) {
        state = {}
    }
}

export function savePRState() {
    try {
        if (!existsSync(STORAGE_DIR)) {
            mkdirSync(STORAGE_DIR, { recursive: true })
        }
        writeFileSync(STORAGE_FILE, JSON.stringify(state, null, 2))
    } catch (e) {
        // Ignore
    }
}

export function updatePRState(sessionID: string, pr: Partial<PRState>) {
    const current = state[sessionID] || { updatedAt: new Date().toISOString() }
    state[sessionID] = {
        ...current,
        ...pr,
        updatedAt: new Date().toISOString()
    }
    savePRState()
}

export function getPRState(sessionID: string): PRState | undefined {
    return state[sessionID]
}

// Initial load
loadPRState()
