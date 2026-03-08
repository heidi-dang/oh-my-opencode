export interface CoverageResult {
  file: string
  functionsPercent: number
  linesPercent: number
  uncoveredLines: string
}

export interface CoverageSummary {
  results: CoverageResult[]
  totalLinesPercent: number
  totalFunctionsPercent: number
}
