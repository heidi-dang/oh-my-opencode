## Summary

Post-merge verification tests for the completion state enforcement fix merged in v3.13.1.

## Bug Fixed

The vulnerability was in `sync-session-poller.ts` where a fallback path treated **any assistant text** as completion without verifying `complete_task` was called and succeeded:

```typescript
// REMOVED VULNERABLE CODE:
if (!lastAssistant?.info?.finish && hasAssistantText) {
  break  // Returns "done" without verifying complete_task!
}
```

## Root Cause

- `sync-session-poller.ts` had a fallback that treated assistant text as completion
- This bypassed the strict issue resolution enforcement
- Allowed tasks to finish even when `complete_task` was rejected or missing

## Changes Made (v3.13.1)

1. **`src/shared/verify-task-completion.ts`**:
   - Added `requireCompleteTask` option
   - Fixed fail-closed exception handling (was returning `true` on error, now returns `false`)

2. **`src/tools/delegate-task/sync-session-poller.ts`**:
   - Removed vulnerable fallback path that treated assistant text as completion
   - Only `isSessionComplete()` (verified terminal finish) allows completion

3. **`src/tools/delegate-task/sync-task.ts`**:
   - Added verification with `requireCompleteTask: true` before treating as success

## Test Output

```
✅ POST-MERGE VERIFICATION PASSED:
   - Assistant emitted final text: YES
   - complete_task called: NO
   - verifyTaskCompletionState returned: false
   - Task stays in_progress: VERIFIED

✅ REJECTED COMPLETE_TASK SCENARIO PASSED:
   - complete_task was REJECTED: YES
   - verifyTaskCompletionState returned: false
   - Task stays in_progress: VERIFIED

✅ SUCCESSFUL COMPLETE_TASK SCENARIO PASSED:
   - complete_task succeeded: YES
   - verifyTaskCompletionState returned: true
   - Task can finish: VERIFIED

3 tests pass, 0 fail
```

## Verification Results

| Scenario | Expected | Result |
|----------|----------|--------|
| Assistant text + NO complete_task | Task stays in_progress | ✅ VERIFIED |
| Rejected complete_task | Task stays in_progress | ✅ VERIFIED |
| Successful complete_task | Task can finish | ✅ VERIFIED |

## Files Changed

- `src/tools/delegate-task/post-merge-verification.test.ts` (NEW)
