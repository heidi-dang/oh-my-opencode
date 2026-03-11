# Toast Fail-Open Rules

## Core Principles

1. **Toasts are UI decoration, not control flow**
   - Toast failures must never crash the runtime
   - Toast failures must never block session/task execution
   - Toast failures must never prevent cancellation/cleanup

2. **Fire-and-forget always**
   - Never await toast operations
   - Never chain logic after toast calls
   - Never use toast results for decision making

3. **Fail-open behavior**
   - If UI context is missing, skip silently
   - If toast system fails, continue execution
   - If payload is invalid, drop the toast

## Required Implementation Patterns

### ✅ Correct: SafeToastWrapper
```typescript
// Always use SafeToastWrapper
SafeToastWrapper.showError(ctx, "Error Title", "Error message", "context")
SafeToastWrapper.showSuccess(ctx, "Success Title", "Success message", "context")
SafeToastWrapper.showInfo(ctx, "Info Title", "Info message", "context")
SafeToastWrapper.showWarning(ctx, "Warning Title", "Warning message", "context")
```

### ❌ Forbidden: Direct Toast Calls
```typescript
// NEVER call directly
ctx.client.tui.showToast({ body: {...} })
await ctx.client.tui.showToast({ body: {...} })
```

### ❌ Forbidden: Awaiting Toasts
```typescript
// NEVER await toasts
await showSpinnerToast(ctx, version, message)
await showModelCacheWarningIfNeeded(ctx)
```

### ❌ Forbidden: Manual Error Handling
```typescript
// NEVER manual error handling
ctx.client.tui.showToast({ body: {...} })
  .catch((err) => log("Toast failed", err))
```

## Context Rules

### Missing UI Context
```typescript
// ✅ SafeToastWrapper handles this automatically
SafeToastWrapper.showInfo(ctx, "Title", "Message")
// If no TUI context: silent skip with one log
```

### Disposed Session
```typescript
// ✅ SafeToastWrapper handles this automatically
SafeToastWrapper.showError(ctx, "Error", "Message", "session-id")
// If session disposed: silent skip with one log
```

### Background Workers
```typescript
// ✅ SafeToastWrapper works in background contexts
SafeToastWrapper.showInfo(ctx, "Task Complete", "Background task finished")
// If no UI context: silent skip, background task continues
```

## Timing Rules

### Startup/Initialization
```typescript
// ✅ Fire-and-forget during startup
showConfigErrorsIfAny(ctx)  // Not awaited
showModelCacheWarningIfNeeded(ctx)  // Not awaited
showVersionToast(ctx, version, message)  // Not awaited
```

### During Cancellation
```typescript
// ✅ Safe to call during cancellation
SafeToastWrapper.showWarning(ctx, "Cancelled", "Task was cancelled")
// Cancellation continues uninterrupted
```

### During Teardown
```typescript
// ✅ Safe to call during teardown
SafeToastWrapper.showInfo(ctx, "Cleanup", "Cleaning up resources")
// Teardown continues uninterrupted
```

## Error Handling Rules

### Toast System Unavailable
```typescript
// ✅ SafeToastWrapper handles automatically
SafeToastWrapper.showError(ctx, "Error", "Something went wrong")
// If toast system down: logged once, execution continues
```

### Network/UI Errors
```typescript
// ✅ SafeToastWrapper handles automatically
SafeToastWrapper.showSuccess(ctx, "Success", "Operation completed")
// If network error: logged once, execution continues
```

### Invalid Payload
```typescript
// ✅ SafeToastWrapper validates automatically
SafeToastWrapper.showInfo(ctx, "", "Message")  // Empty title
// Result: toast skipped, no error, execution continues
```

## Spam Prevention Rules

### Repeated Failures
```typescript
// ✅ SafeToastWrapper throttles error logging
for (let i = 0; i < 100; i++) {
  SafeToastWrapper.showError(ctx, "Error", "Repeated error")
}
// Result: Only 1 error logged per 5 seconds per context
```

### High-Frequency Events
```typescript
// ✅ Safe for high-frequency events
setInterval(() => {
  SafeToastWrapper.showInfo(ctx, "Status", "Heartbeat")
}, 100)
// Result: Toasts shown, errors throttled if any
```

## Context Naming Rules

### Use Descriptive Contexts
```typescript
// ✅ Good: Specific context
SafeToastWrapper.showError(ctx, "Error", "Message", "no-sisyphus-gpt:session-123")
SafeToastWrapper.showSuccess(ctx, "Guard Active", "Message", "semantic-loop-guard:session-456")
SafeToastWrapper.showWarning(ctx, "Cache Missing", "Message", "auto-update-model-cache")

// ❌ Bad: Generic context
SafeToastWrapper.showError(ctx, "Error", "Message", "error")
SafeToastWrapper.showInfo(ctx, "Info", "Message", "info")
```

### Context Format
```
{feature-name}:{optional-specific-id}
```

Examples:
- `no-sisyphus-gpt:session-123`
- `semantic-loop-guard:session-456`
- `auto-update-model-cache`
- `background-task:task-789`

## Testing Rules

### Always Test Fail-Open Behavior
```typescript
// ✅ Test missing UI context
const ctxWithoutTui = { client: {} }
SafeToastWrapper.showError(ctxWithoutTui, "Error", "Message")
// Expect: No crash, no error thrown

// ✅ Test failing toast system
const ctxWithFailingToast = {
  client: { tui: { showToast: () => { throw new Error("Failed") } } }
}
SafeToastWrapper.showError(ctxWithFailingToast, "Error", "Message")
// Expect: No crash, error logged
```

### Always Test Non-Blocking
```typescript
// ✅ Test execution continues immediately
const start = Date.now()
SafeToastWrapper.showError(ctx, "Error", "Message")
const duration = Date.now() - start
// Expect: duration < 1ms (non-blocking)
```

## Migration Rules

### When Converting Old Code
1. Import SafeToastWrapper
2. Replace direct toast calls with wrapper methods
3. Remove await keywords
4. Remove manual error handling
5. Add descriptive context

### Example Migration
```typescript
// Before (unsafe)
await ctx.client.tui.showToast({
  body: { title: "Error", message: "Something failed", variant: "error" }
}).catch((err) => {
  log("Toast failed", err)
})

// After (safe)
SafeToastWrapper.showError(ctx, "Error", "Something failed", "feature-name:context")
```

## Enforcement

### Doctor Checks
The `shared-toast-wrapper-fix-31-38.py` doctor check enforces:
- No direct toast calls remain
- No awaited toast operations
- SafeToastWrapper is used everywhere
- Test coverage exists

### Lint Rules
Consider adding ESLint rules to prevent:
- Direct `client.tui.showToast` calls
- Awaiting toast operations
- Missing context in SafeToastWrapper calls

## Summary

By following these rules, we ensure that:
1. Toast operations never crash the runtime
2. UI context absence is handled gracefully
3. Toast failures don't block execution
4. Error logging is throttled to prevent spam
5. All feature families have consistent, safe toast behavior

These rules make toast operations truly fail-open and non-blocking, ensuring the stability of the entire plugin regardless of UI system state.
