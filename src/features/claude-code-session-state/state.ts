export const subagentSessions = new Set<string>()
export const syncSubagentSessions = new Set<string>()
export const issueModeSessions = new Set<string>()

let _mainSessionID: string | undefined

export function setMainSession(id: string | undefined) {
  _mainSessionID = id
}

export function getMainSessionID(): string | undefined {
  return _mainSessionID
}

/** @internal For testing only */
export function _resetForTesting(): void {
  _mainSessionID = undefined
  subagentSessions.clear()
  syncSubagentSessions.clear()
  issueModeSessions.clear()
  sessionAgentMap.clear()
}

const sessionAgentMap = new Map<string, string>()

export function setSessionAgent(sessionID: string, agent: string): void {
  if (!sessionAgentMap.has(sessionID)) {
    sessionAgentMap.set(sessionID, agent)
  }
}

export function updateSessionAgent(sessionID: string, agent: string): void {
  sessionAgentMap.set(sessionID, agent)
}

export function getSessionAgent(sessionID: string): string | undefined {
  return sessionAgentMap.get(sessionID)
}

export function clearSessionAgent(sessionID: string): void {
  sessionAgentMap.delete(sessionID)
}

export function setSessionIssueMode(sessionID: string): void {
  issueModeSessions.add(sessionID)
}

export function isSessionIssueMode(sessionID: string): boolean {
  return issueModeSessions.has(sessionID)
}

export function clearSessionIssueMode(sessionID: string): void {
  issueModeSessions.delete(sessionID)
}
