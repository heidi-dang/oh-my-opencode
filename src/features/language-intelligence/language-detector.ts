import { existsSync, readdirSync } from "fs"
import { join } from "path"
import { log } from "../../shared/logger"
import type { LanguageProfile } from "./types"

interface LanguageIndicator {
  language: string
  files: string[]
  extensions: string[]
  buildTool?: string
  testTool?: string
  lintTool?: string
  weight: number
}

const LANGUAGE_INDICATORS: LanguageIndicator[] = [
  {
    language: "python",
    files: ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "Pipfile", "poetry.lock", "uv.lock"],
    extensions: [".py"],
    weight: 1.0,
  },
  {
    language: "typescript",
    files: ["tsconfig.json", "tsconfig.build.json"],
    extensions: [".ts", ".tsx"],
    weight: 1.0,
  },
  {
    language: "javascript",
    files: ["package.json", "jsconfig.json"],
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    weight: 0.7,
  },
  {
    language: "rust",
    files: ["Cargo.toml", "Cargo.lock"],
    extensions: [".rs"],
    weight: 1.0,
  },
  {
    language: "go",
    files: ["go.mod", "go.sum"],
    extensions: [".go"],
    weight: 1.0,
  },
  {
    language: "ruby",
    files: ["Gemfile", "Rakefile", ".ruby-version"],
    extensions: [".rb"],
    weight: 1.0,
  },
  {
    language: "java",
    files: ["pom.xml", "build.gradle", "build.gradle.kts"],
    extensions: [".java", ".kt"],
    weight: 1.0,
  },
]

const BUILD_TOOL_MAP: Record<string, Record<string, string>> = {
  python: {
    "pyproject.toml": "auto",
    "requirements.txt": "pip",
    "Pipfile": "pipenv",
    "poetry.lock": "poetry",
    "uv.lock": "uv",
  },
  typescript: {
    "bun.lockb": "bun",
    "bunfig.toml": "bun",
    "pnpm-lock.yaml": "pnpm",
    "yarn.lock": "yarn",
    "package-lock.json": "npm",
  },
  rust: { "Cargo.toml": "cargo" },
  go: { "go.mod": "go" },
}

const TEST_TOOL_MAP: Record<string, Record<string, string>> = {
  python: {
    "pytest.ini": "pytest",
    "pyproject.toml": "pytest",
    "tox.ini": "tox",
    ".noxfile": "nox",
  },
  typescript: {
    "vitest.config.ts": "vitest",
    "jest.config.ts": "jest",
    "jest.config.js": "jest",
    "bunfig.toml": "bun:test",
  },
}

const LINT_TOOL_MAP: Record<string, Record<string, string>> = {
  python: {
    "ruff.toml": "ruff",
    ".flake8": "flake8",
    "mypy.ini": "mypy",
  },
  typescript: {
    ".eslintrc.js": "eslint",
    ".eslintrc.json": "eslint",
    "eslint.config.js": "eslint",
    "biome.json": "biome",
  },
}

function detectToolFromFiles(directory: string, toolMap: Record<string, string>): string | undefined {
  for (const [file, tool] of Object.entries(toolMap)) {
    if (existsSync(join(directory, file))) return tool
  }
  return undefined
}

export async function detectLanguage(directory: string): Promise<LanguageProfile> {
  const scores = new Map<string, { score: number; indicators: string[] }>()

  let topLevelFiles: string[] = []
  try {
    topLevelFiles = readdirSync(directory)
  } catch {
    log("[language-detector] Failed to read directory", { directory })
    return { primary: "unknown", secondary: [], confidence: 0, indicators: [] }
  }

  for (const indicator of LANGUAGE_INDICATORS) {
    let matchScore = 0
    const matchedIndicators: string[] = []

    for (const file of indicator.files) {
      if (topLevelFiles.includes(file)) {
        matchScore += indicator.weight
        matchedIndicators.push(file)
      }
    }

    const extensionMatches = topLevelFiles.filter((f) =>
      indicator.extensions.some((ext) => f.endsWith(ext))
    )
    if (extensionMatches.length > 0) {
      matchScore += Math.min(extensionMatches.length * 0.3, 1.0)
      matchedIndicators.push(`${extensionMatches.length} ${indicator.language} files`)
    }

    if (matchScore > 0) {
      const existing = scores.get(indicator.language) ?? { score: 0, indicators: [] }
      scores.set(indicator.language, {
        score: existing.score + matchScore,
        indicators: [...existing.indicators, ...matchedIndicators],
      })
    }
  }

  // TypeScript upgrades JavaScript if both detected
  if (scores.has("typescript") && scores.has("javascript")) {
    const tsEntry = scores.get("typescript")!
    const jsEntry = scores.get("javascript")!
    tsEntry.score += jsEntry.score * 0.5
    tsEntry.indicators.push(...jsEntry.indicators)
    scores.delete("javascript")
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1].score - a[1].score)

  if (sorted.length === 0) {
    return { primary: "unknown", secondary: [], confidence: 0, indicators: [] }
  }

  const primary = sorted[0][0]
  const secondary = sorted.slice(1).map(([lang]) => lang)
  const confidence = Math.min(sorted[0][1].score / 3.0, 1.0)
  const indicators = sorted[0][1].indicators

  const buildTool = detectToolFromFiles(directory, BUILD_TOOL_MAP[primary] ?? {})
  const testTool = detectToolFromFiles(directory, TEST_TOOL_MAP[primary] ?? {})
  const lintTool = detectToolFromFiles(directory, LINT_TOOL_MAP[primary] ?? {})

  log("[Heidi Language Intelligence] Detected language profile", {
    primary,
    secondary,
    confidence,
    buildTool,
    testTool,
    indicators,
  })

  return { primary, secondary, confidence, indicators, buildTool, testTool, lintTool }
}
