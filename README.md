# Oh My OpenCode (Heidi Reliability Fork)

> [!NOTE]
> This is the **heidi-dang/oh-my-opencode** fork, transformed for **10/10 Reliability**.
> Upstream: [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

<div align="center">
  <img src="./.github/assets/hero.jpg" width="800" />
</div>

<div align="center">
  [![GitHub Release](https://img.shields.io/github/v/release/heidi-dang/oh-my-opencode?color=369eff&labelColor=black&logo=github&style=flat-square)](https://github.com/heidi-dang/oh-my-opencode/releases)
  [![npm downloads](https://img.shields.io/npm/dt/oh-my-opencode?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/@heidi-dang/oh-my-opencode)
  [![License](https://img.shields.io/badge/license-SUL--1.0-white?labelColor=black&style=flat-square)](https://github.com/heidi-dang/oh-my-opencode/blob/dev/LICENSE.md)
  
  [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)
</div>

---

# OhMyOpencode: 10/10 Reliability Runtime (Heidi System)

This repository contains the **Heidi Reliability Extension** for OhMyOpencode, transforming a flexible but non-deterministic agent into a production-grade, hallucination-resistant autonomous system.

## ⚠️ Security & Audit Status (2026-03-08)

A comprehensive hard audit revealed several critical and high-risk vulnerabilities in the runtime tools. **This plugin should be used with extreme caution until these are resolved.**

### Identified Weak Points (AUDIT FAILURES):
- **❌ Symlink Escape (CRITICAL)**: `fs_safe` fails to check for symlinks, allowing agents to potentially write/delete files anywhere on the system.
- **❌ Dangerous Git Commands (HIGH)**: `git_safe` lacks a blacklist for destructive flags like `--force`, `-f`, or `clean -f`.
- **❌ Command Injection (HIGH)**: Naive argument parsing in `git_safe`/`gh_safe` is vulnerable to injection attacks.
- **❌ Session Isolation (MEDIUM)**: `complete_task` allows entries with null session IDs to pass verification, leading to cross-session contamination.
- **❌ CWD Fallback (MEDIUM)**: Runtime tools fall back to `process.cwd()` when `context.directory` is missing, posing risks in multi-repo environments.

---

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
- **Tool Registry (`src/runtime/tools/registry.ts`)**: Agents are restricted to a whitelist of deterministic tools. Direct shell execution or unauthorized SDK calls are blocked.

### 2. State Ledger & Execution Journal
- **State Ledger (`src/agents/runtime/state-ledger.ts`)**: A centralized record of every system change. Tools must return verifiable metadata to be recorded.
- **Execution Journal**: A deterministic log of intents, actions, and results for auditing.

### 3. Completion Authority Rule
- Agents are forbidden from declaring "Task Complete" or "Success" in free text.
- Only the `complete_task` tool, which reads the `StateLedger`, is authorized to produce the final success report.

### 4. Advanced Loop Guard
- **Sequential Limits**: Hard caps on tool calls (30) and agent recursion depth (4).
- **Semantic Fingerprinting**: Detects repetative fail-retry cycles by hashing the current Plan Step, Goal, and Action.

### 5. Token-Efficient Architecture
- **Prompt Modularization**: Prompt payload reduced by an estimated **60-80%** via modular components and lazy skill loading.
- **Context Trimmer**: Aggressive summarization of file reads and massive terminal outputs.

## Installation

```bash
# Register Heidi Fork
npm install -g @heidi-dang/oh-my-opencode
oh-my-opencode init
```

---

## Introducing Heidi: The Antigravity-Class Specialist

Heidi is not just another agent—she is a high-performance, 1:1 behavioral model of Antigravity, designed for engineers who demand absolute reliability and proactive leadership.

Powered by the **Controlled Agent Runtime (CAR)**, Heidi operates within a strict 7-stage pipeline (Interpret → Retrieve → Plan → Execute → Verify → Repair → Complete). She cannot drift, she cannot claim success without evidence, and she cannot bypass the system-level completion firewall.

- **Deepmind Provenance**: Modeled after the Google Deepmind Antigravity system.
- **Safety First**: Hard-gated tool execution and runtime verification.
- **Zero Hallucination**: Every action is cross-referenced against the State Ledger.
- **Self-Healing**: Autonomous failure classification and up to 3 repair loops per task.

---

## Discipline Agents

| Specialist | Role | Strength |
| :--- | :--- | :--- |
| **Heidi** | **GDM Antigravity** | **Hard-Enforced Reliability Pipeline (CAR)** |
| **Sisyphus** | Orchestrator | Goals -> Plans -> Delegation |
| **Hephaestus** | Deep Worker | Code exploration & Implementation |
| **Prometheus** | Strategic Planner | Strategic interviews & Verification |

---

## Self-Audit Loop

The repository includes a comprehensive self-audit system that systematically audits every function for correctness, performance, and code health.

### Features

- **Repo-wide function discovery**: Scans all TypeScript/JavaScript files (6,348 functions across 1,098 files)
- **Stable function IDs**: Format `relative/path/to/file::functionName::language::lineN`
- **Evidence-producing audits**: Detailed per-function reports with verification results
- **Stateful and resumable**: Progress tracking allows interruption and continuation
- **Automated commits**: Each audit iteration commits changes to main with structured messages
- **Comprehensive verification**: Type checking, build verification, and function-specific analysis

### Usage

```bash
# Generate function inventory
bun run src/cli/index.ts self-audit inventory

# Start full audit loop
bun run src/cli/index.ts self-audit loop

# Resume from previous state
bun run src/cli/index.ts self-audit loop --resume

# Limited iterations
bun run src/cli/index.ts self-audit loop --max-iterations 10

# Check current status
bun run src/cli/index.ts self-audit status
```

### Audit Process

Each iteration:
1. Selects next pending function from inventory
2. Performs comprehensive analysis for bugs, performance issues, and code health
3. Applies minimal fixes or improvements when justified
4. Runs verification (type checking, build, existing tests)
5. Generates detailed proof report in `docs/self-audit/functions/`
6. Updates progress tracking files
7. Commits and pushes to main with structured commit message

### Output Files

- `docs/self-audit/index.txt`: Function inventory ledger with status tracking
- `docs/self-audit/progress.txt`: Human-readable progress log
- `docs/self-audit/functions/`: Individual function audit reports

### Audit Categories

- **runtime**: Core application logic
- **ui**: User interface components
- **api**: API endpoints and handlers
- **tooling**: Build tools and utilities
- **test-helper**: Test utilities and helpers

The self-audit loop continues until all functions are audited or marked as blocked, providing systematic code quality improvement across the entire repository.

---

## Verification & Integrity

The reliability of this system is verified by:
- **`tools/doctor.py`**: A system-wide integrity check ensuring all reliability components are active.
- **`bun test tests/runtime/test_deterministic_execution.test.ts`**: Proving the runtime correctly blocks hallucinations.

---

## Reviews

> "It just works until the task is done. It is a discipline agent." - B, Quant Researcher

> "If OpenCode is Debian/Arch, OmO is Ubuntu/Omarchy." - Heidi

---

<div align="center">
  **Loved by professionals at**
  <br />
  Google • Microsoft • Amazon • ELESTYLE • Indent
</div>
conflict
