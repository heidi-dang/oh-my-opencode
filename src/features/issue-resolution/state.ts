export interface IssueVerificationState {
  reproduced: boolean
  errorSignatureBefore?: string
  fixApplied: boolean
  reproAfterPassed: boolean
  failureModeChecksPassed: boolean
}

const issueStates = new Map<string, IssueVerificationState>()

export function getIssueState(sessionID: string): IssueVerificationState {
  if (!issueStates.has(sessionID)) {
    issueStates.set(sessionID, {
      reproduced: false,
      fixApplied: false,
      reproAfterPassed: false,
      failureModeChecksPassed: false,
    })
  }
  return issueStates.get(sessionID)!
}

export function updateIssueState(sessionID: string, partialState: Partial<IssueVerificationState>): IssueVerificationState {
  const currentState = getIssueState(sessionID)
  const newState = { ...currentState, ...partialState }
  issueStates.set(sessionID, newState)
  return newState
}

export function clearIssueState(sessionID: string): void {
  issueStates.delete(sessionID)
}

/** @internal For testing only */
export function _resetIssueStateForTesting(): void {
  issueStates.clear()
}
