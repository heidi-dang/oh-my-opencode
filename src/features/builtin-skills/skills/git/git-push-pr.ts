export const GIT_PUSH_PR_PHASE = `
## PHASE 7: Push & PR Verification (MANDATORY - NEVER SKIP)

<push_pr_verification>

### ANTI-FABRICATION RULE (NON-NEGOTIABLE)

<critical_warning>
**YOU MUST NEVER:**
- Claim "push complete" without running verification commands
- Construct PR URLs manually (e.g., https://github.com/.../pull/N)
- Report task completion without evidence from actual command output
- Assume success from running a command — VERIFY the outcome

**EVERY claim requires PROOF from command output. No exceptions.**
</critical_warning>

### 7.1 Pre-Push Verification (BLOCKING)

\\\`\\\`\\\`bash
# Step 1: Verify working directory is clean
DIRTY=\$(git status --porcelain)
if [ -n "\$DIRTY" ]; then
  echo "FAIL: Uncommitted changes exist. Cannot push."
  git status --porcelain
  # STOP. Do not proceed.
fi

# Step 2: Verify commit was actually created
COMMIT_HASH=\$(git log -1 --format="%H")
echo "Latest commit: \$COMMIT_HASH"
# If this hash is the same as before your work -> commit failed. STOP.

# Step 3: Verify commits exist to push
BRANCH=\$(git branch --show-current)
git log --oneline -5
\\\`\\\`\\\`

**If ANY pre-push check fails → STOP. Do not push. Report the failure.**

### 7.2 Push Execution & Verification

\\\`\\\`\\\`bash
# Push (capture output)
git push origin \$BRANCH 2>&1

# IMMEDIATELY verify push succeeded
UNPUSHED=\$(git rev-list --count origin/\$BRANCH..HEAD 2>/dev/null)
if [ "\$UNPUSHED" != "0" ]; then
  echo "FAIL: Push failed. \$UNPUSHED commits remain unpushed."
  # STOP. Do not claim push succeeded.
fi

echo "VERIFIED: Push succeeded. 0 unpushed commits."
\\\`\\\`\\\`

**NEVER say "push complete" unless \\\`git rev-list --count\\\` returns 0.**

### 7.3 PR Creation & Verification

\\\`\\\`\\\`bash
# Step 1: Create PR and CAPTURE the output (NEVER construct URL manually)
PR_OUTPUT=\$(gh pr create --title "..." --body "..." 2>&1)
PR_EXIT_CODE=\$?

# Step 2: Check if command succeeded
if [ \$PR_EXIT_CODE -ne 0 ]; then
  echo "FAIL: PR creation failed."
  echo "\$PR_OUTPUT"
  # STOP. Do not claim PR was created.
fi

# Step 3: Verify PR actually exists on GitHub
PR_URL=\$(gh pr view --json url --jq '.url' 2>/dev/null)
if [ -z "\$PR_URL" ]; then
  echo "FAIL: PR verification failed. No PR found."
  # STOP. Do not report a PR URL.
fi

# Step 4: Report ONLY the verified URL from GitHub
echo "PR created: \$PR_URL"
\\\`\\\`\\\`

**RULES:**
- The ONLY acceptable PR URL is one returned by \\\`gh pr view --json url\\\`
- NEVER construct a URL like \\\`https://github.com/owner/repo/pull/N\\\`
- NEVER extract a PR number and build a URL from it
- If \\\`gh pr view\\\` fails → PR does not exist. Period.

### 7.4 Completion Evidence (MANDATORY)

\\\`\\\`\\\`
TASK COMPLETION REQUIRES ALL OF:
  [x] commit_hash: <actual hash from git log -1>
  [x] push_verified: git rev-list --count returns 0
  [x] pr_url: <URL returned by gh pr view --json url>

IF ANY IS MISSING → TASK IS NOT COMPLETE.
DO NOT report success. Report what failed.
\\\`\\\`\\\`

### 7.5 Failure Reporting

When any step fails, report honestly:

\\\`\\\`\\\`
STATUS: FAILED at [step]
REASON: [exact error from command output]
LAST SUCCESSFUL STEP: [what did succeed]
RECOVERY: [what user can do]
\\\`\\\`\\\`

**NEVER substitute a failure report with a fabricated success message.**
</push_pr_verification>

`;
