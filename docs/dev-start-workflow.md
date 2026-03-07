# Developer Start Workflow

To maintain a clean repository and minimize merge conflicts, Oh My OpenCode enforces a strict branch-start and PR-creation workflow. This document explains how to use these tools properly.

## 1. Starting a Task

Before writing any code or starting a new branch, you **MUST** run the `start-task.sh` script.

```bash
./tools/start-task.sh <branch-name> [--clean]
```

### What it does:
- Validates that your working directory is clean (fails if there are uncommitted or untracked files).
- Fails if there is a git rebase, cherry-pick, or merge currently in progress.
- Fetches the latest state from `origin` and fast-forwards your local `main` branch safely.
- **If the branch is new**: Creates the branch directly from the fresh `main`.
- **If the branch exists**: Checks out the branch and rebases it onto the fresh `main`.

### The `--clean` flag
If you pass `--clean`, the script will forcefully remove ignored build artifacts (like `node_modules` or `dist`). It will not delete your tracked or untracked work.

---

## 2. During Implementation

While implementing your solution, you can run the full doctor suite at any time to verify system integrity:

```bash
python3 tools/doctor.py --full
```

This runs all reliability checks, LSP checks, git status tests, and evaluates `prepr` conflict risk analysis.

---

## 3. Creating a Pull Request (PR)

Before you are allowed to open a PR, you **MUST** pass the strict pre-PR doctor capabilities. To do this, always create PRs using the `pr.sh` wrapper.

```bash
./tools/pr.sh [gh arguments...]
```

### What it does:
1. It fetches `origin/main`.
2. It runs `python3 tools/doctor.py --prepr`.
3. If `--prepr` passes, it triggers `gh pr create` with whatever arguments you passed.

### The `--prepr` Conflict Check
The `--prepr` flag runs a highly specialized conflict detection routine:
- **Clean Repo**: Fails if you have dirty / uncommitted files.
- **Freshness**: Fails if your branch is missing commits from `origin/main` (meaning you must re-run `start-task.sh` to rebase).
- **Overlapping Files**: Calculates overlap between files you've modified and files modified on `origin/main`.
- **High Severity Flags**: Strongly flags lockfiles, configurations, schemas, and API routes that are edited simultaneously.
- **Simulated Merge**: Runs `git merge-tree` to prove the branch can merge without manual conflict resolution.

**NOTE:** This tool drastically reduces conflict likelihood at the time of PR creation, but it cannot mathematically guarantee zero conflicts if `main` updates seconds *after* you run it. Therefore, you must always run `pr.sh` (or `doctor.py --prepr`) **immediately before** merging or requesting review.
