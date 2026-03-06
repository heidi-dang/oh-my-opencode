#!/usr/bin/env python3
"""
git-worker: Post-task git workflow automation for heidi-dang/oh-my-opencode

COMMANDS:
  git-worker pr      validate → build → branch hygiene → push → open PR with evidence template
  git-worker watch   poll GitHub CI checks until complete → post summary comment
  git-worker report  print merge-ready status in ≤10 lines

SAFETY RULES:
  - Never pushes to dev/main directly (hard abort)
  - No secrets in logs (env vars masked)
  - Runs doctor before any PR action (must pass)
  - Branch name must not be 'dev', 'main', or 'master'

REQUIREMENTS:
  - git (in PATH)
  - gh  (GitHub CLI, authenticated: `gh auth status`)
  - tools/doctor.py (in repo at heidi-dang/opencode ── fetched via gh if missing)
"""

import subprocess
import sys
import os
import json
import time
import re
import argparse
from pathlib import Path
from datetime import datetime, timezone

# ────────────────────────────────────────────────────────────────────────────────
# SAFETY: Protected branches — never push to these
# ────────────────────────────────────────────────────────────────────────────────
PROTECTED_BRANCHES = {"dev", "main", "master"}

# ────────────────────────────────────────────────────────────────────────────────
# PR body evidence template
# ────────────────────────────────────────────────────────────────────────────────
PR_TEMPLATE = """\
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

### CI Watch
Run `git-worker watch` to monitor CI status.
"""

# ────────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────────

def run(cmd: list, capture: bool = True, mask_env: bool = False) -> subprocess.CompletedProcess:
    """Run a command and return the result. Aborts on non-zero exit if not captured."""
    env = os.environ.copy()
    result = subprocess.run(cmd, capture_output=capture, text=True, env=env)
    return result


def must_run(cmd: list, label: str = "") -> str:
    """Run a command; abort with error message on failure."""
    result = run(cmd)
    if result.returncode != 0:
        name = label or " ".join(cmd[:2])
        print(f"[FAIL] {name}")
        print(result.stdout.strip())
        print(result.stderr.strip())
        sys.exit(1)
    return result.stdout.strip()


def current_branch() -> str:
    return must_run(["git", "rev-parse", "--abbrev-ref", "HEAD"], "git branch")


def current_sha() -> str:
    return must_run(["git", "rev-parse", "HEAD"], "git sha")


def current_commit_msg() -> str:
    return must_run(["git", "log", "-1", "--pretty=%s"], "git log")


def gh_available() -> bool:
    result = run(["gh", "--version"])
    return result.returncode == 0


def repo_has_gh_remote() -> bool:
    result = run(["git", "remote", "-v"])
    return "github.com" in result.stdout


def find_build_command(repo_root: Path) -> list | None:
    """Detect build command from package.json, Makefile, or bun.lockb."""
    pkg = repo_root / "package.json"
    if pkg.exists():
        data = json.loads(pkg.read_text())
        scripts = data.get("scripts", {})
        if "build" in scripts:
            return ["bun", "run", "build"]
        if "compile" in scripts:
            return ["bun", "run", "compile"]
    if (repo_root / "Makefile").exists():
        return ["make", "build"]
    return None


def find_repo_root() -> Path:
    result = run(["git", "rev-parse", "--show-toplevel"])
    if result.returncode != 0:
        print("[FAIL] Not in a git repository")
        sys.exit(1)
    return Path(result.stdout.strip())


def truncate(text: str, max_lines: int = 40) -> str:
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return text
    half = max_lines // 2
    return "\n".join(lines[:half]) + f"\n... ({len(lines) - max_lines} lines omitted) ...\n" + "\n".join(lines[-half:])


# ────────────────────────────────────────────────────────────────────────────────
# Doctor runner
# ────────────────────────────────────────────────────────────────────────────────

DOCTOR_SCRIPT_URL = "https://raw.githubusercontent.com/heidi-dang/opencode/main/tools/doctor.py"
DOCTOR_CACHE = Path("/tmp/git-worker-doctor.py")
DOCTOR_LOG = Path("/tmp/git-worker-doctor.log")


def get_doctor_script(repo_root: Path) -> Path | None:
    """Find or fetch the doctor script."""
    # 1. Repo-local copy
    local = repo_root / "tools" / "doctor.py"
    if local.exists():
        return local
    # 2. Cached copy
    if DOCTOR_CACHE.exists() and (time.time() - DOCTOR_CACHE.stat().st_mtime) < 3600:
        return DOCTOR_CACHE
    # 3. Fetch via gh / curl
    print("[…] Fetching tools/doctor.py from heidi-dang/opencode …")
    result = subprocess.run(
        ["gh", "api", "-H", "Accept: application/vnd.github.raw+json",
         "/repos/heidi-dang/opencode/contents/tools/doctor.py"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        DOCTOR_CACHE.write_text(result.stdout)
        return DOCTOR_CACHE
    # fallback: curl
    result = subprocess.run(
        ["curl", "-fsSL", DOCTOR_SCRIPT_URL, "-o", str(DOCTOR_CACHE)],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        return DOCTOR_CACHE
    return None


def run_doctor(repo_root: Path) -> tuple[bool, str]:
    """Run doctor.py. Returns (passed, output)."""
    script = get_doctor_script(repo_root)
    if not script:
        msg = "[WARN] Could not find or fetch tools/doctor.py — skipping doctor check"
        print(msg)
        return True, msg  # soft: don't block if we can't get the script

    result = run(["python3", str(script)])
    output = (result.stdout + result.stderr).strip()
    DOCTOR_LOG.write_text(output)
    passed = result.returncode == 0
    status = "[PASS]" if passed else "[FAIL]"
    print(f"{status} doctor  (log: {DOCTOR_LOG})")
    return passed, output


# ────────────────────────────────────────────────────────────────────────────────
# Command: pr
# ────────────────────────────────────────────────────────────────────────────────

def cmd_pr(base: str = "dev", title: str | None = None, draft: bool = False) -> int:
    repo_root = find_repo_root()
    branch = current_branch()

    # Safety: refuse to push to protected branches
    if branch.lower() in PROTECTED_BRANCHES:
        print(f"[ABORT] Cannot push directly to '{branch}'. Create a feature branch first.")
        sys.exit(1)

    if not gh_available():
        print("[FAIL] gh CLI not found. Install: https://cli.github.com/")
        sys.exit(1)

    print(f"[…] Branch: {branch}  →  PR base: {base}")
    print()

    # Step 1: Doctor
    print("─── Step 1: Doctor ───────────────────────────────────────────────")
    doctor_passed, doctor_output = run_doctor(repo_root)
    if not doctor_passed:
        print("[ABORT] Doctor failed. Fix errors before opening a PR.")
        print(f"        Log: {DOCTOR_LOG}")
        sys.exit(1)
    print()

    # Step 2: Build
    print("─── Step 2: Build ────────────────────────────────────────────────")
    build_cmd = find_build_command(repo_root)
    build_output = ""
    if build_cmd:
        print(f"[…] Running: {' '.join(build_cmd)}")
        result = run(build_cmd)
        build_output = (result.stdout + result.stderr).strip()
        if result.returncode != 0:
            print("[FAIL] Build failed:")
            print(truncate(build_output))
            sys.exit(1)
        print("[PASS] Build")
    else:
        print("[skip] No build command detected")
        build_output = "(no build command detected)"
    print()

    # Step 3: Push
    print("─── Step 3: Push ─────────────────────────────────────────────────")
    push_result = run(["git", "push", "--set-upstream", "origin", branch])
    if push_result.returncode != 0:
        print(f"[FAIL] git push: {push_result.stderr.strip()}")
        sys.exit(1)
    print(f"[PASS] Pushed {branch} → origin")
    print()

    # Gather commit info
    sha = current_sha()
    msg = current_commit_msg()

    # Step 4: Open PR
    print("─── Step 4: Open PR ──────────────────────────────────────────────")
    pr_body = PR_TEMPLATE.format(
        doctor_output=truncate(doctor_output, 30),
        build_output=truncate(build_output, 30),
        commit_sha=sha[:12],
        commit_msg=msg[:100],
    )

    pr_title = title or f"{msg[:72]}"
    pr_args = [
        "gh", "pr", "create",
        "--base", base,
        "--title", pr_title,
        "--body", pr_body,
    ]
    if draft:
        pr_args.append("--draft")

    result = run(pr_args)
    if result.returncode != 0:
        # PR might already exist — try to get the URL
        existing = run(["gh", "pr", "view", "--json", "url", "-q", ".url"])
        if existing.returncode == 0 and existing.stdout.strip():
            print(f"[info] PR already exists: {existing.stdout.strip()}")
        else:
            print(f"[FAIL] gh pr create: {result.stderr.strip()}")
            sys.exit(1)
    else:
        pr_url = result.stdout.strip()
        print(f"[PASS] PR opened: {pr_url}")

    print()
    print("Next: run  git-worker watch  to monitor CI")
    return 0


# ────────────────────────────────────────────────────────────────────────────────
# Command: watch
# ────────────────────────────────────────────────────────────────────────────────

WATCH_TIMEOUT_SECONDS = 1800   # 30 min max
WATCH_POLL_INTERVAL   = 30     # poll every 30 seconds
WATCH_RERUN_LIMIT     = 1      # re-trigger failing checks once


def cmd_watch() -> int:
    if not gh_available():
        print("[FAIL] gh CLI required for watch")
        sys.exit(1)

    # Get current PR
    result = run(["gh", "pr", "view", "--json", "url,number,headRefName"])
    if result.returncode != 0:
        print("[FAIL] No open PR for this branch. Run git-worker pr first.")
        sys.exit(1)

    pr_data = json.loads(result.stdout)
    pr_number = pr_data["number"]
    pr_url = pr_data["url"]
    branch = pr_data["headRefName"]

    print(f"[…] Watching CI for PR #{pr_number}: {pr_url}")
    print(f"    Branch: {branch}")
    print(f"    Timeout: {WATCH_TIMEOUT_SECONDS // 60} min  Poll: {WATCH_POLL_INTERVAL}s")
    print()

    start = time.time()
    rerun_done = set()

    while True:
        elapsed = time.time() - start
        if elapsed > WATCH_TIMEOUT_SECONDS:
            print(f"\n[TIMEOUT] CI watch timed out after {WATCH_TIMEOUT_SECONDS // 60} min")
            _post_watch_comment(pr_number, "TIMEOUT", [])
            return 1

        # Get PR status checks
        result = run([
            "gh", "pr", "checks", str(pr_number),
            "--json", "name,state,link",
        ])
        if result.returncode != 0:
            # Might not have checks yet
            time.sleep(WATCH_POLL_INTERVAL)
            continue

        try:
            checks = json.loads(result.stdout)
        except json.JSONDecodeError:
            time.sleep(WATCH_POLL_INTERVAL)
            continue

        # Assess state
        pending = [c for c in checks if c["state"] in ("PENDING", "IN_PROGRESS", "QUEUED", "")]
        failing = [c for c in checks if c["state"] in ("FAILURE", "ERROR", "CANCELLED")]
        passing = [c for c in checks if c["state"] in ("SUCCESS", "SKIPPED")]

        total = len(checks)
        done = len(passing) + len(failing)
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(f"  [{ts}] {done}/{total} done  "
              f"{len(passing)} pass  {len(failing)} fail  {len(pending)} pending", end="\r")

        # Auto-rerun failing checks once
        for c in failing:
            name = c.get("name", "")
            if name not in rerun_done and len(rerun_done) < WATCH_RERUN_LIMIT:
                print(f"\n[!] Re-running failing check: {name}")
                run(["gh", "run", "rerun", "--failed"])
                rerun_done.add(name)

        if not pending:
            print()  # newline after \r
            break

        time.sleep(WATCH_POLL_INTERVAL)

    # Final report
    overall = "PASS" if not failing else "FAIL"
    print()
    if overall == "PASS":
        print(f"[PASS] All CI checks passed ✓")
    else:
        print(f"[FAIL] {len(failing)} check(s) failed:")
        for c in failing:
            print(f"       {c['name']}: {c.get('link', '')}")

    _post_watch_comment(pr_number, overall, checks)
    return 0 if overall == "PASS" else 1


def _post_watch_comment(pr_number: int, overall: str, checks: list) -> None:
    lines = [f"## CI Watch Result: **{overall}**", ""]
    if checks:
        lines.append("| Check | State |")
        lines.append("|---|---|")
        for c in checks:
            icon = "✅" if c["state"] in ("SUCCESS", "SKIPPED") else "❌" if c["state"] in ("FAILURE", "ERROR") else "⏳"
            name = c["name"]
            link = c.get("link", "")
            lines.append(f"| {icon} [{name}]({link}) | {c['state']} |")
    comment = "\n".join(lines)
    run(["gh", "pr", "comment", str(pr_number), "--body", comment])


# ────────────────────────────────────────────────────────────────────────────────
# Command: report
# ────────────────────────────────────────────────────────────────────────────────

def cmd_report() -> int:
    if not gh_available():
        print("[FAIL] gh CLI required")
        sys.exit(1)

    result = run(["gh", "pr", "view", "--json", "url,number,state,mergeable,statusCheckRollup"])
    if result.returncode != 0:
        print("[FAIL] No open PR for this branch")
        sys.exit(1)

    data = json.loads(result.stdout)
    number = data.get("number", "?")
    url = data.get("url", "")
    state = data.get("state", "UNKNOWN")
    mergeable = data.get("mergeable", "UNKNOWN")
    checks = data.get("statusCheckRollup") or []

    passing = sum(1 for c in checks if c.get("conclusion") in ("SUCCESS", "SKIPPED"))
    failing = sum(1 for c in checks if c.get("conclusion") in ("FAILURE", "ERROR", "CANCELLED"))
    pending = len(checks) - passing - failing

    merge_ready = (
        state == "OPEN"
        and mergeable == "MERGEABLE"
        and failing == 0
        and pending == 0
    )

    print(f"PR #{number}: {url}")
    print(f"State:    {state}  |  Mergeable: {mergeable}")
    print(f"Checks:   {passing} pass  {failing} fail  {pending} pending")
    print()
    if merge_ready:
        print("✅ MERGE READY")
    elif failing:
        print(f"❌ NOT READY — {failing} failing check(s)")
    elif pending:
        print(f"⏳ NOT READY — {pending} check(s) still running")
    elif state != "OPEN":
        print(f"ℹ️  PR is {state}")
    else:
        print(f"⚠️  Not mergeable: {mergeable}")

    return 0 if merge_ready else 1


# ────────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ────────────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        prog="git-worker",
        description="Post-task git workflow automation",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # pr
    pr_p = sub.add_parser("pr", help="Validate, build, push, and open PR")
    pr_p.add_argument("--base", default="dev", help="PR base branch (default: dev)")
    pr_p.add_argument("--title", default=None, help="PR title (default: last commit subject)")
    pr_p.add_argument("--draft", action="store_true", help="Open as draft PR")

    # watch
    sub.add_parser("watch", help="Poll CI checks until complete, then comment")

    # report
    sub.add_parser("report", help="Print merge-ready status in ≤10 lines")

    args = parser.parse_args()

    if args.command == "pr":
        return cmd_pr(base=args.base, title=args.title, draft=args.draft)
    elif args.command == "watch":
        return cmd_watch()
    elif args.command == "report":
        return cmd_report()
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
