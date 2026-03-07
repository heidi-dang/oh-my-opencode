import { join } from "node:path"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { getDataDir } from "../../shared/data-path"

export interface IssueVerificationState {
  reproduced: boolean
  errorSignatureBefore?: string
  fixApplied: boolean
  reproAfterPassed: boolean
  failureModeChecksPassed: boolean
}

const DATA_DIR = join(getDataDir(), "oh-my-opencode")
const ISSUE_STATE_FILE = join(DATA_DIR, "issue-verification-state.json")

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadFromDisk(): Map<string, IssueVerificationState> {
  try {
    if (existsSync(ISSUE_STATE_FILE)) {
      const data = JSON.parse(readFileSync(ISSUE_STATE_FILE, "utf8"))
      return new Map(Object.entries(data))
    }
  } catch (e) {
    // Fallback to empty map
  }
  return new Map()
}

function saveToDisk(states: Map<string, IssueVerificationState>) {
  ensureDataDir()
  const data = Object.fromEntries(states)
  writeFileSync(ISSUE_STATE_FILE, JSON.stringify(data, null, 2))
}

const issueStates = loadFromDisk()

export function getIssueState(sessionID: string): IssueVerificationState {
  if (!issueStates.has(sessionID)) {
    issueStates.set(sessionID, {
      reproduced: false,
      fixApplied: false,
      reproAfterPassed: false,
      failureModeChecksPassed: false,
    })
    saveToDisk(issueStates)
  }
  return issueStates.get(sessionID)!
}

export function updateIssueState(sessionID: string, partialState: Partial<IssueVerificationState>): IssueVerificationState {
  const currentState = getIssueState(sessionID)
  const newState = { ...currentState, ...partialState }
  issueStates.set(sessionID, newState)
  saveToDisk(issueStates)
  return newState
}

export function clearIssueState(sessionID: string): void {
  issueStates.delete(sessionID)
  saveToDisk(issueStates)
}

/** @internal For testing only */
export function _resetIssueStateForTesting(): void {
  issueStates.clear()
  if (existsSync(ISSUE_STATE_FILE)) {
    try {
      const fs = require("node:fs")
      fs.unlinkSync(ISSUE_STATE_FILE)
    } catch (e) {}
  }
}
