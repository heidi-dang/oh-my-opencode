# Runtime Enforcement Guard Soft-Fail Implementation

## Motivation
The agent text output was previously checked by a hard-throwing runtime enforcement guard in `src/hooks/runtime-enforcement/hook.ts`. 

```typescript
// Old site:
if (!actuallyExecuted) {
    throw new Error(
        `[Runtime Enforcement Guard] State claim REJECTED. ` +
        `\nAgent text contained "${check.phrase}" but ${check.tool} was not executed in the current completion flow. ` +
        `You MUST execute the corresponding tool instead of just claiming completion.`
    )
}
```

This crashes web sessions because a hard throw from within the transform hook aborts the session processing completely, sometimes causing a refresh loop if the UI tries to retry loading the last messages over and over. A guard can block invalid completion claims, but should not take down the whole page.

## Changes Made
1. **Removed the throw**: `throw new Error(...)` was removed.
2. **Rewriting text**: The string match for the offending completion claim modifies the assistant's output to neutralize the fake completion: `[REDACTED: False completion claim (${check.phrase})]\n\nI described changes as completed, but the corresponding tool (${check.tool}) was not fully executed in this scope. My claim has been intercepted.`
3. **Outer Boundary**: We added a `try...catch` block surrounding all transform hook invocations in `src/plugin/messages-transform.ts`. This ensures that even if other guards throw an exception, it is caught and logged, preventing session crashes.
4. **Doctor Configuration**: A dedicated script `tools/checks/check_runtime_enforcement_guard.py` ensures the guard source file never includes an unhandled throw.

## Examples

### Invalid Completion Claim
Agent states: `I fixed it. It's resolved.` Without running `complete_task`.
- **Before**: Session hard crashes.
- **After**: The text becomes `[REDACTED: False completion claim (resolved.)]\n\nI described changes as completed...`

### Valid Completion Claim
Agent output: `Here is the last fix. resolved.` along with `complete_task` invocation.
- **Before**: Executes normally. Full message is retained.
- **After**: Executes normally. Full message is retained.
