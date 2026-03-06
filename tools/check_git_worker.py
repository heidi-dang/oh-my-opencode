"""
check_git_worker.py — git-worker doctor check for tools/doctor.py

Validates the git-worker installation:
1. git-worker.py is present at tools/git-worker.py
2. docs/implementation-git_worker.md exists
3. git-worker enforces no-direct-push to dev/main (source code check)
4. PR template contains required evidence placeholders
"""

import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent

REQUIRED_EVIDENCE_PLACEHOLDERS = [
    "{doctor_output}",
    "{build_output}",
    "{commit_sha}",
]

PROTECTED_BRANCH_GUARD = "PROTECTED_BRANCHES"


def check_git_worker_present() -> list:
    issues = []
    script = REPO_ROOT / "tools" / "git-worker.py"
    if not script.exists():
        issues.append({
            "severity": "error",
            "title": "git-worker.py missing",
            "description": "tools/git-worker.py not found.",
            "fix": "Create tools/git-worker.py with pr/watch/report commands.",
        })
    return issues


def check_docs_present() -> list:
    issues = []
    doc = REPO_ROOT / "docs" / "implementation-git_worker.md"
    if not doc.exists():
        issues.append({
            "severity": "error",
            "title": "git-worker docs missing",
            "description": "docs/implementation-git_worker.md not found.",
            "fix": "Create docs/implementation-git_worker.md.",
        })
    return issues


def check_protected_branch_guard() -> list:
    issues = []
    script = REPO_ROOT / "tools" / "git-worker.py"
    if not script.exists():
        return issues  # already flagged
    content = script.read_text()
    if PROTECTED_BRANCH_GUARD not in content:
        issues.append({
            "severity": "error",
            "title": "No protected-branch guard in git-worker",
            "description": "git-worker.py does not define PROTECTED_BRANCHES, so it may push directly to dev/main.",
            "fix": "Add PROTECTED_BRANCHES check that aborts push to dev/main/master.",
        })
    # Check that 'dev' and 'main' are in the set
    if '"dev"' not in content or '"main"' not in content:
        issues.append({
            "severity": "error",
            "title": "Protected branch set incomplete",
            "description": "'dev' and 'main' must be in PROTECTED_BRANCHES.",
            "fix": "Add 'dev' and 'main' to PROTECTED_BRANCHES in git-worker.py.",
        })
    return issues


def check_pr_template_placeholders() -> list:
    issues = []
    script = REPO_ROOT / "tools" / "git-worker.py"
    if not script.exists():
        return issues
    content = script.read_text()
    for placeholder in REQUIRED_EVIDENCE_PLACEHOLDERS:
        if placeholder not in content:
            issues.append({
                "severity": "error",
                "title": f"PR template missing placeholder: {placeholder}",
                "description": f"git-worker.py PR body template is missing '{placeholder}'.",
                "fix": f"Add '{placeholder}' to PR_TEMPLATE in git-worker.py.",
            })
    return issues


def run_checks() -> list:
    all_issues = []
    all_issues += check_git_worker_present()
    all_issues += check_docs_present()
    all_issues += check_protected_branch_guard()
    all_issues += check_pr_template_placeholders()
    return all_issues


if __name__ == "__main__":
    issues = run_checks()
    errors = [i for i in issues if i["severity"] == "error"]
    warnings = [i for i in issues if i["severity"] == "warning"]

    if not issues:
        print("[PASS] git-worker: all checks passed")
        sys.exit(0)

    for issue in issues:
        level = "ERROR" if issue["severity"] == "error" else "WARN"
        print(f"[{level}] {issue['title']}")
        print(f"       {issue['description']}")
        if "fix" in issue:
            print(f"       Fix: {issue['fix']}")
        print()

    if errors:
        print(f"[FAIL] {len(errors)} error(s), {len(warnings)} warning(s)")
        sys.exit(1)
    else:
        print(f"[WARN] {len(warnings)} warning(s)")
        sys.exit(0)
