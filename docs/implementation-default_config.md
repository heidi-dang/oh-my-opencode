# oh-my-opencode Default Config

## Goal

When users install `@heidi-dang/oh-my-opencode`, one command writes the Heidi "performance default" config to the correct global path — no guessing `.json` vs `.jsonc`.

## Command

```bash
oh-my-opencode init           # write if missing
oh-my-opencode init --force   # overwrite existing
```

## Config Written

**Path:**
- Linux/macOS: `~/.config/opencode/oh-my-opencode.json`
- Windows: `%APPDATA%\opencode\oh-my-opencode.json`

**Source:** `assets/default-oh-my-opencode.json` (embedded as fallback in the npm bundle)

## Heidi Performance Default Config

```json
{
  "$schema": "https://raw.githubusercontent.com/heidi-dang/oh-my-opencode/dev/assets/oh-my-opencode.schema.json",
  "agents": {
    "sisyphus": {
      "model": "xai/grok-4-1-fast",
      "ultrawork": { "model": "xai/grok-4-1-fast", "variant": "max" }
    },
    "librarian": { "model": "xai/grok-4-1-fast-non-reasoning" },
    "explore":   { "model": "xai/grok-4-1-fast-non-reasoning" },
    "oracle":    { "model": "xai/grok-4-1-fast", "variant": "high" },
    "prometheus": {
      "prompt_append": "Prefer fast agents; only trigger ultrawork when necessary. Parallelize but avoid duplicate work."
    }
  },
  "categories": {
    "quick":             { "model": "opencode-go/minimax-m2.5" },
    "unspecified-low":   { "model": "xai/grok-4-1-fast-non-reasoning" },
    "unspecified-high":  { "model": "xai/grok-4-1-fast", "variant": "high" },
    "visual-engineering":{ "model": "google/gemini-3-pro-preview", "variant": "high" },
    "writing":           { "model": "xai/grok-4-1-fast-non-reasoning" }
  },
  "background_task": {
    "providerConcurrency": {
      "xai": 8, "opencode-go": 6, "opencode": 2,
      "google": 1, "openai": 1, "anthropic": 1
    },
    "modelConcurrency": {
      "xai/grok-4-1-fast-non-reasoning": 8,
      "xai/grok-4-1-fast": 2,
      "opencode-go/minimax-m2.5": 6
    }
  }
}
```

## Safety Rules

| Scenario | Behavior |
|---|---|
| Config file missing | Write it |
| Config file exists | Skip (print "exists") |
| Config file exists + `--force` | Overwrite |
| Asset JSON is invalid | Abort with error (never write garbage) |
| Config directory missing | Create it (`mkdir -p`) |

## Precedence

Config files are merged in this order (highest precedence first):
1. **Project config**: `.opencode/oh-my-opencode.json[c]`
2. **Global config**: `~/.config/opencode/oh-my-opencode.json` ← **this file**
3. **Plugin defaults**

## Implementation Files

| File | Purpose |
|---|---|
| `assets/default-oh-my-opencode.json` | Template file (shipped in repo and npm package) |
| `src/cli/init/index.ts` | Init command implementation |
| `src/cli/cli-program.ts` | CLI registration |
| `src/cli/doctor/checks/default-config.ts` | Doctor check |

## Doctor Check

```
✓ Default Config    Default config asset valid, init command registered
```

Fails if:
- `assets/default-oh-my-opencode.json` is missing or invalid JSON
- `init` command not registered in `cli-program.ts`
- README doesn't mention `oh-my-opencode init` (warning)
