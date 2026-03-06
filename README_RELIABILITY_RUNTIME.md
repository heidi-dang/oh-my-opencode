# OhMyOpencode: 10/10 Reliability Runtime (Heidi System)

This repository contains the **Heidi Reliability Extension** for OhMyOpencode, transforming a flexible but non-deterministic agent into a production-grade, hallucination-resistant autonomous system.

## Comparison: Official Repo vs. Heidi System

| Layer | Official repo | Heidi system |
| :--- | :--- | :--- |
| **Agent prompts** | Strong | **Strong** |
| **Skills** | Strong | Moderate (Strict Registry) |
| **Runtime verification** | Weak | **Strong (Centralized)** |
| **Determinism** | Weak | **Strong (Hard Enforced)** |
| **Loop guard** | None | **Strong (Semantic & Limit-based)** |
| **Ledger state** | None | **Strong (Single Source of Truth)** |
| **Completion authority** | None | **Strong (Runtime Only)** |

---

## Core Improvements & Technical Architecture

### 1. Hard Determinism & Registry
- **Action Validator (`src/agents/runtime/action-validator.ts`)**: Every agent output is validated against a strict Zod schema. Malformed JSON or free-text claims are rejected before reaching the tools.
- **Tool Registry (`src/runtime/tools/registry.ts`)**: Agents are restricted to a whitelist of deterministic tools. Direct shell execution or unauthorized SDK calls are blocked at the runtime level.

### 2. State Ledger & Execution Journal
- **State Ledger (`src/agents/runtime/state-ledger.ts`)**: A centralized, verified record of every system change (git push, file write). Tools must return verifiable metadata to be recorded.
- **Execution Journal**: A deterministic log of intents, actions, and results, allowing for precise auditing and system "rewind" capabilities.

### 3. Completion Authority Rule
- Agents are **forbidden** from declaring "Task Complete" or "Success" in free text.
- Only the `complete_task` tool, which reads the `StateLedger`, is authorized to produce the final success report.
- Our **Runtime Enforcement Hook** scans for and blocks unauthorized completion claims.

### 4. Advanced Loop Guard
- **Sequential Limits**: Hard caps on tool calls (30) and agent recursion depth (4).
- **Semantic Fingerprinting**: Detects repetative fail-retry cycles by hashing the current Plan Step, Goal, and Action. Loops are aborted within 3 iterations.

### 5. Token-Efficient Architecture
- **Prompt Modularization**: Monolithic prompts were deconstructed into modular components (`base-system`, `execution-rules`, `hard-blocks`).
- **Context Trimmer**: Aggressive summarization of file reads and command outputs, leading to an estimated **60-80% reduction in token usage** per turn.
- **Dynamic Context Builder**: Lazy-loads only the skill schemas and ledger entries immediately relevant to the active plan step.

### 6. Centralized Verification Engine
- Verification is no longer left to the agent's discretion.
- The `verify_action` tool uses pre-defined check scripts in the runtime, ensuring that the system state matches the agent's intent before updating the ledger.

---

## Verification & Integrity

The reliability of this system is verified by:
- **`tools/doctor.py`**: A system-wide integrity check ensuring all reliability components are active and correctly wired.
- **`tests/runtime/test_deterministic_execution.test.ts`**: A suite of tests specifically targeting loop detection, action validation, and ledger accuracy.
