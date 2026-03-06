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

---

## Installation

```bash
# Register Heidi Fork
npm install -g @heidi-dang/oh-my-opencode
oh-my-opencode init
```

---

## Discipline Agents

| Specialist | Role | Strength |
| :--- | :--- | :--- |
| **Sisyphus** | Orchestrator | Goals -> Plans -> Delegation |
| **Hephaestus** | Deep Worker | Code exploration & Implementation |
| **Prometheus** | Strategic Planner | Strategic interviews & Verification |

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
