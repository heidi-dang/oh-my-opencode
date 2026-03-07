# Implementation Plan: Plan Compiler Guard Unlock (Refined)

## Problem
The `PlanCompiler` stores state globally in a singleton, causing "Active Step" locks to persist across unrelated tasks/sessions. Session-ID scoping alone may be insufficient if multiple tasks or retries occur within one session. Stale plans block critical tools like `todowrite`, `task`, and `read`.

## Solution: Session+Task Scoping & Safe Recovery
Refactor `PlanCompiler` to use `sessionID` + `taskID` ownership and implement automatic/manual recovery paths.

### 1. Robust Ownership (SessionID + TaskID)
- Verify session/task relationships. Scope state by `sessionID` + `taskID` (or `planID`).
- `submit_plan` generates or accepts a unique `taskID`.
- `PlanEnforcementHook` and tools must use this composite key.

### 2. Full Lifecycle Cleanup
Clear plan state on:
- **Session Deleted**: All session state evicted.
- **Plan Completed**: Last step marked complete -> Clear.
- **Task Cancelled/Failed**: Hook into relevant failure events.
- **Explicit Reset**: New `unlock_plan` tool for manual escape.
- **New Plan Overwrite**: `submit_plan` implicitly replaces current session's plan.
- **Startup**: Reset purely in-memory state.

### 3. Stale-State Auto-Recovery
Before the Guard blocks a tool:
1. Validate if the graph exists for the current session.
2. Check if the active step index is valid and not already finished.
3. If invalid state is detected, **auto-clear** it and log a warning instead of blocking.

### 4. Concurrency & Safety
- Use Map-based isolation for session state.
- Handle potential races between tool execution and state modification using atomic updates.

### 5. Strengthened Doctor Check
- Reproduce the real bug:
  - Create Context A (blocked by Plan).
  - Create Context B (unrelated).
  - Prove B is NOT blocked by A.
  - Prove A can be unlocked via `unlock_plan`.

## File Map
- **Core Logic**: `src/runtime/plan-compiler.ts`
- **Hook (Guard)**: `src/hooks/plan-enforcement/hook.ts`
- **Tools**: `src/runtime/tools/plan.ts` (Update existing + add `unlock_plan`)
- **Lifecycle**: `src/plugin/event.ts`
- **Doctor Checks**:
  - `src/cli/doctor/checks/plan-compiler.ts` (New)
  - `src/cli/doctor/checks/index.ts` (Registration)
  - `src/cli/doctor/constants.ts` (Constants)

## Verification & Testing
- **New Tests**: `src/runtime/plan-compiler.test.ts` (covering isolation, failure modes, and recovery).
- **Doctor Check**: Fails before fix, passes after.
- **Manual Verification**: Reproduce original blocker -> apply fix -> verify `todowrite/task/read` working -> continue original task.
