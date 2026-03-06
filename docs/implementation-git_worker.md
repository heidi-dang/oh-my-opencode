# git-worker — Implementation Guide

## Goal

One command that runs the full post-task workflow:
validate → branch hygiene → build → push → open PR with evidence → watch CI → report merge-ready.

## Commands

### `git-worker pr`
```bash
git-worker pr                      # PR base: dev (default)
git-worker pr --base main          # target main
git-worker pr --title "feat: foo"  # override PR title
git-worker pr --draft              # open as draft
```

**Steps executed in order:**
1. **Branch safety check** — Aborts if current branch is `dev`, `main`, or `master`
2. **Doctor** — runs `tools/doctor.py` from `heidi-dang/opencode` (fetched via `gh` if not local); must pass
3. **Build** — auto-detects `bun run build` / `make build`; must pass
4. **Push** — `git push --set-upstream origin <branch>`
5. **PR creation** — `gh pr create` with evidence template in PR body

### `git-worker watch`
```bash
git-worker watch
```
- Polls `gh pr checks` every 30 seconds
- Max timeout: 30 minutes
- Auto-reruns failing checks once (via `gh run rerun --failed`)
- Posts a CI summary comment to the PR: ✅/❌ per check

### `git-worker report`
```bash
git-worker report
```
- Prints PR state, CI check summary, and merge-ready verdict in ≤10 lines
- Exit 0 = merge ready, exit 1 = not ready

## Evidence Template (PR Body)

```markdown
## Evidence

### Doctor Check
```
{doctor_output}
```

### Build Output
```
{build_output}
```

### Commit
```
{commit_sha}  {commit_msg}
```

### Checklist
- [ ] Doctor passed (no errors)
- [ ] Build succeeded
- [ ] Tests green (CI)
- [ ] No direct push to dev/main
```

## Safety Rules

| Rule | Enforcement |
|---|---|
| No direct push to `dev`/`main`/`master` | Hard abort in `cmd_pr()` |
| Doctor must pass before PR | Aborts on non-zero exit |
| Build must pass before PR | Aborts on non-zero exit |
| No secrets in logs | All subprocess calls use captured output; env not printed |

## CI Watch Rules

| Parameter | Value |
|---|---|
| Poll interval | 30 seconds |
| Timeout | 30 minutes |
| Auto-rerun limit | 1 time per failing check |
| Checks to wait for | All (`gh pr checks`) |

## Failure Behavior

| Failure | Behavior |
|---|---|
| Doctor fails | Print log path, abort |
| Build fails | Show truncated output (first+last 20 lines), abort |
| Push fails | Print error, abort |
| PR already exists | Print existing PR URL, continue |
| CI timeout | Post TIMEOUT comment to PR, exit 1 |

## Requirements

- Python 3.9+
- `git` in PATH
- `gh` (GitHub CLI) — authenticated: `gh auth status`
- `tools/doctor.py` in `heidi-dang/opencode` (fetched automatically if missing)

## Installation

The script lives at `tools/git-worker.py`. Make it executable and optionally symlink:

```bash
chmod +x tools/git-worker.py
ln -s "$(pwd)/tools/git-worker.py" /usr/local/bin/git-worker
```

Or run directly:
```bash
python3 tools/git-worker.py pr
```

## Doctor Check

`tools/check_git_worker.py` validates the installation. It is wired into `tools/doctor.py`.

Fails if:
- `tools/git-worker.py` missing
- `docs/implementation-git_worker.md` missing
- `PROTECTED_BRANCHES` guard missing from source (dev/main safety)
- PR template missing evidence placeholders (`{doctor_output}`, `{build_output}`, `{commit_sha}`)
