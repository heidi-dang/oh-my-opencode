# Technical Plan: Selective Upstream Capability Merge

## Goal
Port advanced prompting and verification logic from `official/dev` to Heidi while maintaining 10/10 reliability via the deterministic runtime layer.

## Status: COMPLETED (Phase 0 & Phase 1)

### Phase 0: Atlas & QA Strictness [DONE]
- [x] **Atlas Guard**: Clarified completion authority in all Atlas variants.
- [x] **QA Strictness**: Ported Metis/Momus strictness hooks.
- [x] **Gemini Fix**: Corrected syntax in `atlas/gemini.ts`.
- [x] **Verification**: Created `check_upstream_capability_merge.py` and integrated into `doctor.py`.

### Phase 1: Specialty Agents, Ralph-loop & Truth Model Hardening [DONE]
- [x] **Hephaestus Autonomy**: Ported "Deep Agent" and "Intent Gate" logic to `hephaestus/gpt-5-4.ts`.
- [x] **Ralph-loop**: Integrated runtime loop detection in `runtime-enforcement/hook.ts`.
- [x] **State Tracking**: Updated `state-ledger` and `tool-runner` to support loop detection and successful state change verification.
- [x] **Truth Model**: Unified `state-ledger` to securely track `success`, `verified`, and `changedState` tied to the current execution flow.
- [x] **Runtime Enforcement**: Tightened `hook.ts` to scan only the active completion flow for deterministic tool evidence rather than relying on weak keywords or stale ledger history.
- [x] **Completion & Query**: `complete_task` and `query_ledger` filtered strictly to verified, successful state changes from the active session flow.
- [x] **Contract Enforcement**: Enforced strict boolean typing for state metadata in the tool-contract hook, intrinsically linking claimed state changes to the verified ledger.
- [x] **Capability Purge**: Removed the active builder pattern (`dynamic-agent-prompt-builder.ts`) from Sisyphus and Hephaestus, migrating all logic to Heidi's native `prompts/orchestration.ts` and `types.ts`.
- [x] **Audit Architecture**: Purged prototype scaffolding (`agent-runner.ts`, `tool-runner.ts`, `context-builder.ts`) and updated the reliability doctor checks.

### Phase 3: Live Wiring & Truth Model Finalization
- [ ] **Active Tool Wiring**: Inject `DETERMINISTIC_TOOLS` (e.g., `query_ledger`, `complete_task`, `verify_action`, `git_safe`, `fs_safe`, `submit_plan`, `mark_step_complete`) into the active `createToolRegistry` located in `src/plugin/tool-registry.ts`.
- [ ] **Active Hook Wiring**: Expose `execution-journal`, `tool-contract`, `runtime-enforcement`, and `plan-enforcement` hooks via `src/plugin/hooks/create-tool-guard-hooks.ts` to ensure they run in the live post-execution flow.
- [ ] **Strict Tool Contract Consistency**: Update all deterministic tools to universally return the strict payload: `success`, `verified`, `changedState`, `stdout`, and conditionally `stateChange`, `sessionID`, `timestamp`. This includes `complete_task`.
- [ ] **Filter Enforcement**: Ensure `complete_task` follows the same contract, and remains locked to returning only verified, successful, current-session entries.
- [ ] **Orphan Scaffolding Removal**: Sweep and purge remaining references to the deleted prototype modules (`agent-runner`, `tool-runner`, `context-builder`) from the codebase.

## Verification Plan

### Automated Checks
- `python3 tools/doctor.py` (Custom capability check + Reliability check)
- `bun test src/hooks/runtime-enforcement/ src/runtime/` (Deterministic state testing)
- `bun test tests/runtime/test_deterministic_execution.test.ts` (Reliability regression)

### Manual Review
- Inspect `src/runtime/state-ledger.ts` for strict verifiable payloads.
- Inspect `src/hooks/tool-contract/hook.ts` for deterministic rejection logic.
- Verify `dynamic-agent-prompt-builder.ts` is fully eradicated from imports where appropriate.
- Inspect `src/agents/atlas/gemini.ts` for clean syntax.
- Inspect `src/hooks/runtime-enforcement/hook.ts` for loop guard logic.
