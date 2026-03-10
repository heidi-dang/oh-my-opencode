# Language Intelligence System — Phase 1 Implementation Plan

Language-aware runtime: detect → route → load pack → follow stepbook → execute.

## Architecture

```
Task Received
    ↓
Language Detector
    ↓
Language Router
    ↓
Python Pack
TypeScript Pack
Rust/Go Pack
    ↓
Stepbook Loader
    ↓
Context Injection
    ↓
Agent Executes
    ↓
Language Memory Save
```

### Flow

1. `chat.message` hook detects language from working directory
2. Language profile is registered in `ContextCollector` as persistent context
3. If a task-class match is found (e.g. "install and run"), matching stepbook is also injected
4. Agent executes with language-specific knowledge + stepbook as context
5. On success, language memory records what worked

## New Feature Module

All files go in `src/features/language-intelligence/`.

### [NEW] language-detector.ts

Scans working directory for language indicator files. Returns a prioritized list of detected languages.

**Detection matrix:**

| Files | Language |
|--------|----------|
| pyproject.toml, requirements.txt, setup.py, *.py | python |
| package.json, tsconfig.json, *.ts, *.tsx | typescript |
| Cargo.toml, *.rs | rust |
| go.mod, *.go | go |
| Gemfile, *.rb | ruby |
| pom.xml, build.gradle, *.java | java |

**API:**

```typescript
interface LanguageProfile {
  primary: string           // "python" | "typescript" | "rust" | "go"
  secondary: string[]       // other detected languages
  confidence: number        // 0-1
  indicators: string[]      // files that triggered detection
  buildTool?: string        // "pip" | "poetry" | "uv" | "npm" | "bun" | "pnpm" | "cargo"
  testTool?: string         // "pytest" | "vitest" | "jest" | "bun:test" | "cargo test"
}

function detectLanguage(directory: string): Promise<LanguageProfile>
```

### [NEW] language-router.ts

Maps a `LanguageProfile` to correct knowledge pack and searches for matching stepbooks.

**API:**

```typescript
function routeLanguage(profile: LanguageProfile, userMessage: string): {
  pack: LanguagePack
  stepbook: Stepbook | null
  taskClass: string | null
}
```

### [NEW] types.ts

Shared types for language intelligence system.

```typescript
interface LanguagePack {
  language: string
  rules: string[]
  repairSteps: Record<string, string[]>
  commandRecipes: Record<string, string>
  failureSignatures: FailureSignature[]
  importPatterns: string
  buildFlow: string
  testFlow: string
  lintFlow: string
}

interface FailureSignature {
  pattern: string | RegExp
  diagnosis: string
  fix: string[]
}

interface Stepbook {
  id: string
  language: string
  taskClass: string
  description: string
  steps: StepbookStep[]
}

interface StepbookStep {
  order: number
  action: string
  command?: string
  validate?: string
  fallback?: string
}
```

### [NEW] packs/python.ts

Python knowledge pack with:

- Import/package layout patterns
- venv, pip, uv, poetry behavior rules
- pytest, ruff, mypy workflow commands
- 12+ failure signatures (ModuleNotFoundError, editable install, wrong cwd, etc.)

### [NEW] packs/typescript.ts

TypeScript knowledge pack with:

- tsconfig/build graph rules
- pnpm/npm/bun patterns
- ESM/CJS trap detection
- vite/next/node runtime issues
- Test tool and lint flow

### [NEW] stepbooks/python-stepbooks.ts

5 stepbooks:

1. **install-and-run** — detect entry, create venv, install deps, run
2. **fix-pytest-failures** — read error, check imports, fix, re-run
3. **add-cli-command** — detect CLI framework, add command, wire entry
4. **fix-import-path** — trace module, fix sys.path or package structure
5. **package-local-module** — setup.py/pyproject.toml, editable install

### [NEW] stepbooks/typescript-stepbooks.ts

5 stepbooks:

1. **install-and-run** — detect package manager, install, start dev server
2. **fix-build-error** — read tsc output, trace error, fix, rebuild
3. **fix-type-error** — read diagnostic, resolve type mismatch
4. **fix-dev-server** — check port, config, restart
5. **add-route-component** — detect framework, scaffold, wire routing

### [NEW] language-intelligence-hook.ts

The main hook that integrates with the plugin system.

**Hook handlers:**

- `chat.message`: Detect language on every first message per session. Register language pack as persistent context via `ContextCollector`.
- `tool.execute.after`: Scan tool outputs for known failure signatures. If a match is found, inject repair steps as high-priority context.

### [NEW] index.ts

Barrel export for module.

## Hook Registration

### [MODIFY] hooks/index.ts

Add export for `createLanguageIntelligenceHook`.

### [MODIFY] create-session-hooks.ts

Register `languageIntelligence` hook with `safeHook`.
