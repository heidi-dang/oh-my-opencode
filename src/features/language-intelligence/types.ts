export interface LanguageProfile {
  primary: string
  secondary: string[]
  confidence: number
  indicators: string[]
  buildTool?: string
  testTool?: string
  lintTool?: string
}

export interface FailureSignature {
  pattern: string
  diagnosis: string
  fix: string[]
}

export interface LanguagePack {
  language: string
  displayName: string
  rules: string[]
  repairSteps: Record<string, string[]>
  commandRecipes: Record<string, string>
  failureSignatures: FailureSignature[]
  importPatterns: string
  buildFlow: string
  testFlow: string
  lintFlow: string
}

export interface StepbookStep {
  order: number
  action: string
  command?: string
  validate?: string
  fallback?: string
}

export interface Stepbook {
  id: string
  language: string
  taskClass: string
  triggers: string[]
  description: string
  steps: StepbookStep[]
}

export interface LanguageRouteResult {
  pack: LanguagePack
  stepbook: Stepbook | null
  taskClass: string | null
}
