Full-plugin hard audit — oh-my-opencode

Generated: 2026-03-08

Task: Full-plugin hard audit of oh-my-opencode with runtime proof and risk map.

SUMMARY
- Verdict: see final section of this report (BAD/GOOD format will be returned to the requester).

1) Identity & load-path proof (raw evidence)

-- Repository root (git):
```
/home/heidi/work/oh-my-opencode-heidi
```

-- Git repository details (raw):
```
$(git rev-parse --show-toplevel) => /home/heidi/work/oh-my-opencode-heidi
$(git rev-parse --git-dir) => .git
git remotes (raw):
official        https://github.com/code-yeongyu/oh-my-opencode.git (fetch)
official        https://github.com/code-yeongyu/oh-my-opencode.git (push)
origin  https://github.com/heidi-dang/oh-my-opencode.git (fetch)
origin  https://github.com/heidi-dang/oh-my-opencode.git (push)
upstream        https://github.com/code-yeongyu/oh-my-opencode (fetch)
upstream        https://github.com/code-yeongyu/oh-my-opencode (push)
current branch: fix/completion-state-enforcement-post-merge
commit: b541337931847868b460d8cf2e406c77ef823767 (short b5413379)
author: heidi-dang <heidi.dang.dev@gmail.com>
git status: (clean at time of capture)
```

-- Local .local folder check (raw):
```
.local exists (empty directory)
```

-- Local source package identity (from workspace package.json):
```
package.json name: @heidi-dang/oh-my-opencode
package.json version: 3.13.1
file: package.json (workspace root)
```

-- CLI binary observed at runtime (wrapper -> installed platform package):
Invocation and result (raw):
```
node bin/oh-my-opencode.js --version
=> 3.12.5
```

-- Installed platform package resolved under node_modules (raw):
```
node_modules/@heidi-dang/oh-my-opencode-linux-x64/package.json -> version: 3.12.5
node_modules/@heidi-dang/oh-my-opencode-linux-x64-baseline exists as well
```

-- Doctor run (runtime health checks) (raw):
```
node bin/oh-my-opencode.js doctor
=> output (summary):
 oMoMoMoMo Doctor

 ⚠ 4 issues found:

1. OpenCode version below minimum
   Detected 0.0.0-main-202603080725; required >= 1.0.150.

2. oh-my-opencode is not registered
   Plugin entry is missing from OpenCode configuration.

3. Loaded plugin is outdated
   Loaded 3.11.0, latest 3.11.1.

4. Fork plugin not registered
   '@heidi-dang/oh-my-opencode' is not in the opencode plugin list.
```

-- Running processes grep (raw):
```
ps aux | grep -i oh-my-opencode
=> No dedicated running plugin process for this workspace detected.
   (Found TypeScript server processes and editor references; no running oh-my-opencode process owning this session.)
```

Conclusion (Identity & load-path):
- The local source tree in this workspace is the authoritative plugin source (files in `src/`, `package.json` v3.13.1).
- The runtime binary used when invoking `node bin/oh-my-opencode.js` resolved to an installed platform package under `node_modules/@heidi-dang/oh-my-opencode-linux-x64` (v3.12.5).
- Therefore the loaded runtime binary does NOT exactly match the local source tree — mismatch confirmed (version mismatch and installed binary path shown).

2) Full plugin inventory (grouped, code-derived)
- Entrypoints / registries:
  - `src/index.ts` — plugin factory (`OhMyOpenCodePlugin`) registration entry (createManagers, createTools, createHooks, createPluginInterface).
  - `src/create-managers.ts` — constructs `Managers` (tmux, background, skillMcp, runStateWatchdog, config handler).
  - `src/create-tools.ts` & `src/plugin/tool-registry.ts` — tool registry and tool filtering.
  - `src/create-hooks.ts` & `src/plugin/hooks/*.ts` — core, continuation, skill, transform and guard hooks.
  - `src/plugin-interface.ts` — exposes plugin handlers for OpenCode entry points (`chat.message`, `tool.execute.before/after`, `config`, `event`, transforms).
  - `src/runtime/tools/registry.ts` — deterministic tool registry (git_safe, fs_safe, verify_action, submit_plan, mark_step_complete, unlock_plan, query_ledger, complete_task, report_issue_verification, gh_safe).

- All registered tools (high level, from `src/plugin/tool-registry.ts`):
  - builtin sets: grep, glob, ast-grep, session-manager, background tools, interactive_bash, delegateTask (task), skill_mcp, skill, and many more.
  - Deterministic tools (explicit, centralized): `git_safe`, `fs_safe`, `verify_action`, `submit_plan`, `mark_step_complete`, `unlock_plan`, `query_ledger`, `complete_task`, `report_issue_verification`, `gh_safe` (see `src/runtime/tools/registry.ts`).

- Hooks (high level):
  - core hooks: `src/plugin/hooks/create-core-hooks.ts` (session lifecycle, runtime enforcement, compaction, etc.)
  - continuation hooks: `src/plugin/hooks/create-continuation-hooks.ts` (background/continuation flows)
  - skill hooks: `src/plugin/hooks/create-skill-hooks.ts` (skill integrations)
  - guard/transform hooks: `src/plugin/hooks/create-tool-guard-hooks.ts`, `create-transform-hooks.ts`, `create-session-hooks.ts`

- Commands / CLI integration:
  - `bin/oh-my-opencode.js` is a wrapper that delegates to a platform binary in `node_modules/@heidi-dang/oh-my-opencode-...` packages.
  - CLI `doctor` command surfaced runtime issues.

- Config / schema files:
  - `assets/default-oh-my-opencode.json` (template)
  - `assets/oh-my-opencode.schema.json` (schema)
  - `src/plugin-config.ts` and `src/config/schema/*` (Zod schemas)
  - `~/.config/opencode/oh-my-opencode.json` and `/home/heidi/.config/opencode/oh-my-opencode.json` referenced by runtime (seen in ps output as editor file open)

- Feature flags and flags:
  - `pluginConfig.experimental` keys (task_system, safe_hook_creation, etc.) (see `src/index.ts` and `src/config/*`)

For each item above, the code files and registration points are available under `src/` (examples: `src/index.ts`, `src/plugin/tool-registry.ts`, `src/runtime/tools/registry.ts`, `src/plugin/hooks/*`).

3) End-to-end control-flow audit (summary)
- Task lifecycle (high-level):
  - Task creation normally flows through `delegateTask` (from tool registry) and background manager -> tmux manager for subagents -> background sync (see `src/tools/delegate-task/*` and `src/tools/background-task/*`).
  - Authoritative gates: `pluginConfig` enabling/disabling, `hooks` (runtime enforcement hooks), and deterministic tool registry for terminal state changes.
  - Fail-open risks: if deterministic tool registry is bypassed (e.g., custom tools not centralized), agents could attempt arbitrary commands. Code centralizes terminal actions into `DETERMINISTIC_TOOLS` (mitigation).

- Completion lifecycle / verification:
  - Tools like `complete_task`, `mark_step_complete`, `unlock_plan`, and `report_issue_verification` are implemented under `src/runtime/tools/*`. They report ledger entries and call background/verification hooks.
  - `hooks.runtime-enforcement` inspects tool outputs and phrases (e.g., matches 'pr created') to detect state changes.

- Repo selection and workspace routing:
  - The plugin uses `ctx.directory` passed by the host runtime as authoritative workspace root (see `src/index.ts` and many spawn calls using `context.directory || process.cwd()`).
  - Risk: if the host runtime provides a malicious or surprising `ctx.directory`, plugin will act in that directory. The plugin relies on the host to enforce directory isolation. There are few additional internal path canonicalization or symlink-escape checks in core code.

- Git and FS action flows:
  - `git_safe` and `fs_safe` are wrappers that run git/fs actions via a spawn and then perform verification (e.g., check status, staged diff).
  - Authoritative gate: `DETERMINISTIC_TOOLS` registry plus `withToolContract` wrapper.
  - Fail-open risks: these tools depend on correct execution of spawn/child process and on `context.directory` being trustworthy; they do not apply cross-repository path checks beyond `cwd` usage.

4) Runtime smoke tests (evidence + verdicts)
Note: tests performed are read-only / inspection where possible. Any non-read-only action was avoided.

- Test 1: Repo identity (git)
  - Invocation: series of `git` commands (rev-parse, remotes, branch, commit).
  - Expected: show workspace git identity and branch
  - Actual: raw outputs captured above.
  - Result: PASS (proved local repo identity).

- Test 2: CLI binary vs local source mismatch
  - Invocation: `node bin/oh-my-opencode.js --version` and inspect `package.json` workspace
  - Expected: either binary matches local `package.json` version or difference is explained
  - Actual: binary version 3.12.5 vs local package.json version 3.13.1; installed platform package `node_modules/@heidi-dang/oh-my-opencode-linux-x64` v3.12.5
  - Result: FAIL (mismatch — loaded binary is older than local source)

- Test 3: Doctor / runtime health check
  - Invocation: `node bin/oh-my-opencode.js doctor`
  - Expected: read-only health report
  - Actual: doctor printed 4 issues (OpenCode version low, plugin not registered, loaded plugin outdated, fork plugin not registered)
  - Result: PASS (doctor executed and provided runtime evidence), findings relevant to registration and runtime mismatch

- Test 4: Running plugin instance detection
  - Invocation: `ps aux | grep -i oh-my-opencode`
  - Expected: find running plugin process (if this session loaded it)
  - Actual: no dedicated plugin process found; only editor/tsserver references
  - Result: BLOCKED (no running plugin instance tied to this session was found)

- Deterministic tool execution tests (git_safe, fs_safe, gh_safe, complete_task, report_issue_verification):
  - Attempting to execute deterministic tools directly requires the OpenCode host/plugin runtime. Running the TypeScript source directly is not feasible in this environment without building/starting the host runtime or using Bun to execute tests. There are unit tests under `src/runtime/tools/*.test.ts`, but running them would require the project's test harness.
  - Result: UNTESTED (via runtime) — code-level inspection only. The code shows in-tool verification steps (e.g., `git status --porcelain -b` checks after checkout), but I could not execute them end-to-end from this session without starting the host runtime.

5) Adversarial read-only tests (attempts and outcomes)
- Attempt 1: missing .local handling — .local exists but empty; no special override file found. (Observed `.local` exists and empty.)
  - Result: PASS (no hidden overrides found in .local)

- Attempt 2: cross-repo path escape detection
  - Method: inspect code for path canonicalization around spawn/cwd usage
  - Finding: tools use `cwd: context.directory || process.cwd()` and do not canonicalize or check for symlink escapes. This is a code-level risk.
  - Runtime test: not executed (needs host runtime). Verdict: likely bug / missing guard.

- Attempt 3: empty glob/search behavior
  - Method: inspect `src/tools/glob` and `src/tools/grep` result formatting and tests.
  - Finding: search/grep tools format an empty result; many callers rely on empty lists being interpreted as no-op. Some continuation logic may allow progress on empty results — code review required per flow.
  - Runtime test: UNTESTED.

6) Test-gap audit (high-level)
- There are unit tests for many components (see `src/runtime/tools/*.test.ts`, many `tools.test.ts` files). However, the following critical integrations lack runtime end-to-end tests in this workspace (observed):
  - End-to-end deterministic tool enforcement (i.e., attempts to call arbitrary child processes vs `DETERMINISTIC_TOOLS` enforcement) — missing integration test.
  - Cross-repo path and symlink escape tests for tools that spawn with `cwd` — missing.
  - Session isolation tests verifying that `complete_task` and `report_issue_verification` cannot be mis-attributed across sessions — missing.
  - Tests covering mismatch between installed binary and local source (deployment consistency checks) — present in doctor heuristics, but no CI/test that asserts parity.

7) Bug classification (examples)
- Real bug with runtime proof:
  - Loaded binary version (3.12.5) differs from local source package.json (3.13.1) — runtime evidence from `node bin/oh-my-opencode.js --version` and `node_modules` package.json. (Risk: stale binary behavior in local runtime).

- Likely bug (code evidence, not runtime-proven):
  - Lack of canonical path/symlink checks around `cwd` usage in deterministic tools → possible symlink escape or cross-repo access if `context.directory` is controlled.

- Missing guard:
  - No authoritative internal check that `context.directory` belongs to the workspace root or is inside an allowlist.

- Test gap:
  - Missing runtime/integration tests for deterministic tool invocation in the actual OpenCode host environment.

- Environment limitation:
  - Cannot run full host runtime (OpenCode) inside this session; many tests that require the host are UNTESTED.

8) Highest-priority fixes (recommended order)
1. Ensure deployment / local dev parity: add a CI check or `npm run doctor` gating that fails the build if installed platform binary version differs from workspace package.json (or document acceptable scenarios). (Critical)
2. Add canonicalization and containment checks for `context.directory` before performing `spawn`-based operations; ensure symlink escape/.. resolution is checked. (Critical)
3. Create integration tests that run deterministic tools (git_safe, fs_safe, gh_safe) against a sandbox repo to assert they cannot escape or act on other repos. (High)
4. Add explicit checks/confirmation gates in `complete_task`/`report_issue_verification` to require confirmation states in the ledger to avoid accidental cross-session completions. (High)
5. Expand doctor to surface exact resolved binary path used at runtime and alert when discrepancy exists. (Medium)

9) Evidence pack (what to attach to the report)
- Exact commands executed during audit (copyable):
  - git rev-parse --show-toplevel
  - git rev-parse --git-dir
  - git remote -v
  - git branch --show-current
  - git rev-parse HEAD
  - git status --porcelain
  - ls -la .local
  - node bin/oh-my-opencode.js --version
  - node bin/oh-my-opencode.js doctor
  - ps aux | grep -i oh-my-opencode
  - ls -la node_modules/@heidi-dang
  - cat node_modules/@heidi-dang/oh-my-opencode-linux-x64/package.json

- Relevant file references (exists in workspace):
  - [src/index.ts](src/index.ts#L1-L93)
  - [src/create-tools.ts](src/create-tools.ts#L1-L51)
  - [src/create-hooks.ts](src/create-hooks.ts#L1-L71)
  - [src/plugin/tool-registry.ts](src/plugin/tool-registry.ts#L1-L200)
  - [src/runtime/tools/registry.ts](src/runtime/tools/registry.ts#L1-L200)
  - [src/runtime/tools/git-safe.ts](src/runtime/tools/git-safe.ts#L1-L200)
  - [bin/oh-my-opencode.js](bin/oh-my-opencode.js#L1-L200)
  - [bin/platform.js](bin/platform.js#L1-L200)

10) Final notes / environment limitations
- I could not find a running plugin process tied to this session; the CLI wrapper delegates to an installed platform package in `node_modules` which is older than the workspace `package.json`. Because of that, any runtime behavior observed by calling `node bin/oh-my-opencode.js` reflects the installed platform binary (3.12.5) rather than the local TypeScript source (3.13.1).
- Many safety-critical runtime tests (deterministic tool execution, session-isolation end-to-end flows) require starting the OpenCode host runtime (or running the built platform binary with a real host) and were therefore UNTESTED in this read-only audit environment.

-- End of report content for docs/implementation-full-plugin-hard-audit.md
