# oh-my-opencode Fork Implementation

**Fork**: `heidi-dang/oh-my-opencode`  
**Upstream**: `code-yeongyu/oh-my-opencode`  
**npm package**: `@heidi-dang/oh-my-opencode`

---

## Goals

- Publish and maintain a scoped fork of oh-my-opencode under `@heidi-dang/oh-my-opencode`
- Enforce a strict model policy: exact-string model IDs, fail-closed on invalid configs
- Implement `*-junior` agent inheritance (e.g., `sisyphus-junior` inherits `sisyphus` model)
- Provide a clear install path (no curl-pipe-bash-only requirement)
- Keep upstream sync easy via `upstream` remote

## Non-Goals

- Renaming internal TypeScript package paths (imports still use relative paths)
- Publishing under the unscoped `oh-my-opencode` name
- Replacing upstream's agent behavior beyond the specified behaviors below

---

## Model Resolution Rules

Resolution order (highest priority first):

1. **Explicit agent override** — `agents.<name>.model` in oh-my-opencode config
2. **Category override** — `categories.<category>.model`
3. **System default model** — OpenCode's active model (UI selection)
4. **Fallback chain** — built-in `AGENT_MODEL_REQUIREMENTS[<name>].fallbackChain`

### Model Policy (Fail-Closed)

- User-configured model IDs are validated against the **available models cache** using **exact string matching**
- No fuzzy matching, no prefix resolution: `grok-4` ≠ `xai/grok-4`
- If the cache is empty (first run), validation is skipped gracefully
- On validation failure: throws with a descriptive error listing valid alternatives
- Run `opencode models` or `opencode models --refresh` to populate the cache

#### Example error
```
[oh-my-opencode] Agent 'sisyphus-junior': configured model 'xai/grok-4-unknown' is not a valid model ID.
Valid alternatives (provider: xai/): xai/grok-4, xai/grok-4-0709, xai/grok-2-1212
Run 'opencode models' to see all available models.
```

---

## Agent Aliasing Rules: *-junior Inheritance

Agents named `<parent>-junior` (kebab-suffix pattern) inherit the parent agent's override config.

### Merge Precedence

```
junior's explicit overrides  >  parent's override  >  built-in defaults
```

### Rules

| Scenario | Result |
|---|---|
| `sisyphus.model = "xai/grok-4"`, no `sisyphus-junior.model` | junior uses `xai/grok-4` |
| `sisyphus.model = "xai/grok-4"`, `sisyphus-junior.model = "anthropic/claude-3-5-sonnet"` | junior uses `anthropic/claude-3-5-sonnet` (explicit wins) |
| No `sisyphus` override | junior uses its built-in default (`anthropic/claude-sonnet-4-6`) |
| Any other field (e.g., `temperature`) not set on junior | inherited from parent |

### Implementation

Wired in `src/plugin-handlers/agent-config-handler.ts` via `resolveJuniorInheritance()` from `src/agents/builtin-agents/junior-inheritance.ts`.

---

## Invalid Model Behavior

1. Plugin startup resolves all `agents.*` overrides
2. For any override with an explicit `.model`, `validateModelPolicy()` is called
3. If the model is not in the available models set → **throws** (fail-closed)
4. OpenCode surfaces the error in the session startup output
5. User must fix the model ID in their config or run `opencode models --refresh`

---

## Install Paths

### Quick Install (recommended)
```bash
npm install -g @heidi-dang/oh-my-opencode
```

Then register in opencode config (`~/.config/opencode/config.jsonc`):
```jsonc
{
  "plugin": ["@heidi-dang/oh-my-opencode"]
}
```

### Manual / Offline Install
```bash
# 1. Clone the fork
git clone https://github.com/heidi-dang/oh-my-opencode
cd oh-my-opencode

# 2. Build
bun install && bun run build

# 3. Register as local plugin in opencode config
# Add to ~/.config/opencode/config.jsonc:
# "plugin": ["file:///path/to/oh-my-opencode"]
```

### Upgrade
```bash
npm update -g @heidi-dang/oh-my-opencode
```

### Sync with upstream
```bash
git fetch upstream
git rebase upstream/main       # or merge: git merge upstream/main
bun install && bun test
```

---

## Compatibility Notes with Upstream

| Area | Status |
|---|---|
| Internal import paths | Unchanged — no package path renaming |
| Config schema | Compatible — same `oh-my-opencode.json` / `.jsonc` format |
| Model fallback chain | Unchanged |
| Agent names | All upstream built-in agents preserved |
| `PACKAGE_NAME` constant | Changed to `@heidi-dang/oh-my-opencode` — affects doctor checks |
| Platform binaries | Renamed packages (`@heidi-dang/oh-my-opencode-{platform}`) — can't mix with upstream |
| `upstream` git remote | Configured for easy `git fetch upstream` sync |

---

## Doctor Checks

Run `oh-my-opencode doctor` to verify the environment:

```
✓ System
✓ Configuration
✓ Tools
✓ Models
✓ Fork Integrity     ← new check
```

The **Fork Integrity** check verifies:
- `opencode config plugin[]` references `@heidi-dang/oh-my-opencode` (not upstream)
- README/docs reference `heidi-dang/oh-my-opencode` fork URL
- `junior-inheritance.ts` module is present and buildable
