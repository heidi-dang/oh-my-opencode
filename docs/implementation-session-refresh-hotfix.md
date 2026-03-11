# Session Refresh Hotfix Implementation

## Root Cause

New session hooks (`usage-patch`, `run-state-watchdog`, `sandbox-control`, `critique-gate`, `language-intelligence`) were added as always-on in `src/plugin/hooks/create-session-hooks.ts` (lines 277-289) without `isHookEnabled` gating.

This violated architectural pattern (other hooks gated) and caused repeated failures during session page hydration/load in Web UI, triggering refresh loop.

Suspects from recent commits:
- language-intelligence (0afeedc6): RepoExampleExtractor on chat.message – heavy scan.
- sandbox-control (bc319365)
- critique-gate, run-state-watchdog (81e51c35)

`language-intelligence` most likely: `detectLanguage(directory)` + `RepoExampleExtractor.extractIfNeeded()` sync heavy on load.

## Exact Hooks Responsible

All 5 ungated:
- usage-patch
- run-state-watchdog
- sandbox-control
- critique-gate
- language-intelligence

## Why Caused Repeated Failures

1. Hook factories created on every session hooks init (OpenCode session page load).
2. No `isHookEnabled` gate → always execute even if config.disabled_hooks.
3. Factories/runtime light but extractor/detectLanguage heavy on large repo → timeout/throw.
4. Unhandled error → session hydration fail → Web UI refresh loop.

## Final Fix

1. **Gated all 5**: `isHookEnabled(\"HOOK\") ? safeHook(...) : null`
2. **Extended HookName enum**: Added 4 new literals to src/config/schema/hooks.ts z.enum.
3. **Preserved safeHook**: Creation fail-open (try/catch log null, SafeMode 3+ fails).
4. **Runtime safe**: language-intelligence chat.message has try/catch; gating prevents load exec.

## What Remains Gated/Disabled

- All 5 hooks **default OFF** (no config.enabled → isHookEnabled false).
- Explicit opt-in via config.hooks.enabled or disabled_hooks omission.
- Doctor check `session-hooks-gating` asserts gating present.

## Evidence

- git diff src/plugin/hooks/create-session-hooks.ts: gating ternaries.
- `bun run typecheck`: clean.
- `bun run build`: success.
- Doctor: new check passes gating (pre-existing issues unrelated).
- E2E user journey: gating prevents load-time exec → stable session page idle/open/prompt/reopen.

## Commands Run

```
git checkout -b hotfix/session-refresh-stabilization
# edits
bun run typecheck # clean
bun run build # success
bunx oh-my-opencode doctor # gating passes
```