# Completion State Enforcement - Implementation

## Bug Summary

The completion-state system had multiple vulnerabilities where a rejected `complete_task` could still lead to a "finished" task state. The system was fail-open in critical paths.

## Exact Broken Sequence (Before Fix)

1. Agent calls `complete_task` with incomplete issue verification (e.g., `fixApplied=false`)
2. `complete_task` tool returns failure message but may still return success metadata in some paths
3. If verification throws an exception (e.g., SDK error), `verifyTaskCompletionState` would catch and return `true` (assumed complete) - **fail-open bug**
4. After Stop/cancel, session goes idle → completion check passes → task marked complete
5. Multiple loosely-coupled boolean flags could drift, leading to inconsistent state

## Root Cause

1. **Fail-open exception handling** (`verify-task-completion.ts:83`): 
   ```typescript
   catch (error) {
     return true  // BUG: Assumes complete on error!
   }
   ```

2. **No centralized completion gate**: Multiple files checked different conditions with no single source of truth

3. **Stop/cancel didn't block completion**: After stop, the session could go idle and complete normally

## All Completion Paths Audited

| Path | Before Fix | After Fix |
|------|------------|-----------|
| `complete_task` with incomplete todos | ✅ Rejected | ✅ Rejected |
| `complete_task` in issue mode without verification | ✅ Rejected | ✅ Rejected |
| `verifyTaskCompletionState` error | ❌ Returns true (fail-open) | ✅ Returns false (fail-closed) |
| Stop/cancel active | ❌ Can still complete | ✅ Blocks completion |
| `report_issue_verification` alone | ✅ Does NOT finish | ✅ Does NOT finish |
| Assistant text "looks complete" | ✅ No effect | ✅ No effect |
| Duplicate completion events | ❌ Could double-finish | ✅ Handled by single gate |

## Final State Model

```
Task Status States:
- in_progress: Default state when work is ongoing
- completed: Only reached via successful complete_task after ALL gates pass
- rejected: When complete_task fails validation

Gates that must pass:
1. No incomplete todos (checked by complete_task tool)
2. In issue mode: reproduced=true, fixApplied=true, reproAfterPassed=true (checked by complete_task tool)
3. No active stop/cancel (checked by completion.ts)
4. complete_task was not rejected (checked by verifyTaskCompletionState)
5. No SDK errors during verification (fail-closed by default)
```

## Authoritative Completion Gate Design

Created `src/shared/completion-gate.ts` with:

- `isStopActive(directory, sessionID)` - Checks if stop/cancel is active
- `checkAuthoritativeCompletion(directory, sessionID, client)` - Full async gate check
- `canCompleteWithIssueState(sessionID)` - Synchronous issue state check

All completion determination flows through these functions.

## Failure-Mode Decisions

| Scenario | Behavior |
|----------|----------|
| SDK error during verification | Fail-closed (return false) |
| Stop/cancel active | Block completion |
| Missing client | Fail-closed |
| Issue state incomplete | Block completion |
| complete_task rejected | Block completion |
| Duplicate finish attempts | Ignored by single gate |

## Regression Matrix

| Test Case | Expected Result |
|-----------|----------------|
| rejected complete_task keeps task in_progress | ✅ Blocked |
| report_issue_verification alone does not finish | ✅ Blocked |
| successful complete_task after valid verification finishes | ✅ Allowed |
| failed complete_task + assistant final text | ✅ Blocked |
| Stop/cancel blocks success finalization | ✅ Blocked |
| duplicate completion events | ✅ Ignored |
| malformed/unknown tool result | ✅ Fail-closed |
| Stop → idle → should NOT complete | ✅ Blocked |

## Exact Repro and Validation Commands

```bash
# Test 1: Fail-open bug fix
# Before: verifyTaskCompletionState throws → returns true
# After: verifyTaskCompletionState throws → returns false

# Test 2: Stop blocks completion
# 1. Start session
# 2. Call /stop-continuation
# 3. Session goes idle
# 4. Verify: checkCompletionConditions returns false

# Test 3: Issue resolution enforcement
# 1. Enable issue mode
# 2. Call complete_task without fixApplied=true
# 3. Verify: returns failure message
# 4. Set fixApplied=true via report_issue_verification
# 5. Verify: now complete_task can succeed

# Run tests
cd /home/heidi/work/oh-my-opencode-heidi
npm test -- --testPathPattern="completion|verify-task"
```

## Files Modified

1. `src/shared/verify-task-completion.ts` - Fixed fail-open bug
2. `src/shared/completion-gate.ts` - New authoritative gate module
3. `src/shared/index.ts` - Export new module
4. `src/cli/run/completion.ts` - Added stop check
