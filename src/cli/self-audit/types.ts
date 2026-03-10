export interface SelfAuditOptions {
  resume: boolean
  functionId?: string
  dryRun: boolean
  maxIterations?: number
}

export interface FunctionInventory {
  functions: AuditFunction[]
  total: number
  generated: string
  commitSha: string
}

export interface AuditFunction {
  id: string
  filePath: string
  functionName: string
  signature?: string
  language: string
  category: FunctionCategory
  status: AuditStatus
  reportPath?: string
  lastCommitSha?: string
  lineStart?: number
  lineEnd?: number
}

export type FunctionCategory = 
  | "runtime"
  | "ui" 
  | "api"
  | "tooling"
  | "test-helper"

export type AuditStatus = 
  | "pending"
  | "in_progress" 
  | "passed"
  | "fixed"
  | "improved"
  | "fixed+improved"
  | "blocked"
  | "skipped"
  | "pass-no-change"

export interface AuditReport {
  functionId: string
  filePath: string
  functionName: string
  signature?: string
  timestamp: string
  commitShaBefore: string
  purpose: string
  callerContext: string
  preAuditFindings: {
    correctness: string
    performance: string
    codeHealth: string
  }
  changes: {
    bugFix?: string
    performanceImprovement?: string
    codeHealthImprovement?: string
  }
  verification: {
    testsRun: string[]
    beforeResult: string
    afterResult: string
  }
  filesChanged: string[]
  finalStatus: "fixed" | "improved" | "fixed+improved" | "pass-no-change" | "blocked"
  commitShaAfter?: string
}

export interface ProgressState {
  currentFunctionIndex: number
  completedFunctions: Set<string>
  inProgressFunction?: string
  lastCommitSha: string
  startTime: string
  lastUpdateTime: string
}

export interface VerificationResult {
  passed: boolean
  testsRun: string[]
  beforeResult: string
  afterResult: string
  issues: string[]
}
