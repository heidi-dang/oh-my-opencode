# Technical Plan: Selective Upstream Capability Merge

## Goal
Port advanced prompting and verification logic from `official/dev` to Heidi while maintaining 10/10 reliability via the deterministic runtime layer.

## Status: COMPLETED (Phase 0 & Phase 1)

### Phase 0: Atlas & QA Strictness [DONE]
- [x] **Atlas Guard**: Clarified completion authority in all Atlas variants.
- [x] **QA Strictness**: Ported Metis/Momus strictness hooks.
- [x] **Gemini Fix**: Corrected syntax in `atlas/gemini.ts`.
- [x] **Verification**: Created `check_upstream_capability_merge.py` and integrated into `doctor.py`.

### Phase 1: Specialty Agents & Ralph-loop [DONE]
- [x] **Hephaestus Autonomy**: Ported "Deep Agent" and "Intent Gate" logic to `hephaestus/gpt-5-4.ts`.
- [x] **Ralph-loop**: Integrated runtime loop detection in `runtime-enforcement/hook.ts`.
- [x] **State Tracking**: Updated `state-ledger` and `tool-runner` to support loop detection.
- [x] **Audit**: Updated doctor checks to verify P1 features.

## Verification Plan

### Automated Checks
- `python3 tools/doctor.py` (Custom capability check)
- `bun test tests/runtime/test_deterministic_execution.test.ts` (Reliability regression)

### Manual Review
- Inspect `src/agents/atlas/gemini.ts` for clean syntax.
- Inspect `src/hooks/runtime-enforcement/hook.ts` for loop guard logic.
