# Heidi: The Reliability Operating System for AI Agents

**Heidi is a high-performance fork of Oh My OpenCode, rebuilt around a Controlled Agent Runtime (CAR) to reduce hallucinations, drift, false completion, and uncontrolled execution.**

<p align="left">
  <a href="https://github.com/heidi-dang/oh-my-opencode/releases">
    <img src="https://img.shields.io/github/v/release/heidi-dang/oh-my-opencode?color=369eff&labelColor=black&logo=github&style=flat-square" alt="GitHub Release" />
  </a>
  <a href="https://www.npmjs.com/package/@heidi-dang/oh-my-opencode">
    <img src="https://img.shields.io/npm/dt/@heidi-dang/oh-my-opencode?color=ff6b35&labelColor=black&logo=npm&style=flat-square" alt="npm downloads" />
  </a>
  <a href="https://github.com/heidi-dang/oh-my-opencode/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-SUL--1.0-white?labelColor=black&style=flat-square" alt="License" />
  </a>
  <a href="https://github.com/heidi-dang/oh-my-opencode/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/heidi-dang/oh-my-opencode/ci.yml?branch=main&label=ci&labelColor=black&style=flat-square" alt="CI Status" />
  </a>
  <a href="https://github.com/heidi-dang/oh-my-opencode">
    <img src="https://img.shields.io/github/stars/heidi-dang/oh-my-opencode?color=f5c542&labelColor=black&style=flat-square" alt="GitHub Stars" />
  </a>
</p>

**Languages:** English | 한국어 | 日本語 | 简体中文

---

## From “Prompt and Pray” to Controlled Execution

Most AI agents still run on a prompt-and-pray model: they ask an LLM to do work and hope it follows instructions.

Heidi is different.

Heidi runs inside a **Controlled Agent Runtime (CAR)** that converts free-form model behavior into a governed execution pipeline. Every task is interpreted, scoped, planned, executed, verified, repaired when necessary, and only then allowed to complete.

The goal is simple:

- reduce false completion
- reduce context drift
- improve task accuracy
- make agent behavior measurable, auditable, and harder to fake

Heidi is not designed to sound smart.  
Heidi is designed to **finish work under control**.

---

## Why Heidi

Heidi exists because raw LLM agents fail in predictable ways:

- they start coding before understanding the task
- they retrieve the wrong files or too much context
- they skip planning
- they claim `done` without proof
- they retry blindly
- they drift away from the user’s real intent mid-task

Heidi addresses those problems at the runtime level, not just in prompts.

### Heidi is built around four ideas

#### 1. State over vibes
Heidi tracks task progress through explicit runtime state instead of inferring success from agent wording.

#### 2. Verification over narration
The system does not trust completion-style language. It trusts verification evidence, runtime ledgers, and gated completion.

#### 3. Retrieval over context dumping
Heidi builds compact, repo-aware task bundles instead of stuffing the model with broad, noisy context.

#### 4. Repair over restart
Failures are classified and routed into bounded repair loops so the system can recover with evidence instead of starting over blindly.

---

## Table of Contents

- [Why Heidi](#why-heidi)
- [Controlled Agent Runtime (CAR)](#controlled-agent-runtime-car)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Runtime Truth Model](#runtime-truth-model)
- [Core Reliability Pillars](#core-reliability-pillars)
- [Agent Roster](#agent-roster)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [How Heidi Executes Work](#how-heidi-executes-work)
- [Verification Model](#verification-model)
- [Completion Firewall](#completion-firewall)
- [Project Structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

---

## Controlled Agent Runtime (CAR)

Heidi’s core is the **Controlled Agent Runtime**, a mandatory execution pipeline that wraps the agent and enforces discipline at runtime and tool boundaries.

### CAR pipeline

```text
User Task
   │
   ▼
┌─────────────┐
│ Interpret   │  → structure goal, constraints, acceptance criteria
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Retrieve    │  → fetch relevant code, tests, config, recent history
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Plan        │  → produce concrete steps, targets, verification path
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Execute     │  → edit, run tools, apply bounded changes
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Verify      │  → static checks, targeted tests, e2e, regression guards
└─────┬───────┘
      │
      ├────────────── failed ──────────────┐
      ▼                                     │
┌─────────────┐                             │
│ Complete    │  ← completion firewall      │
└─────────────┘                             │
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │ Repair      │  → bounded retry with failure evidence
                                     └─────┬───────┘
                                           │
                                           └──────────── back to Execute / Verify
```

### What CAR enforces

- **structured task interpretation** before execution
- **repo-aware retrieval** before code changes
- **mandatory planning** before edits
- **verification as a required phase**, not optional agent behavior
- **bounded repair loops** with failure evidence
- **hard-gated completion** through a completion firewall

**The agent does not decide when the task is done. The runtime does.**

---

## Architecture at a Glance

### Reliability control plane

```text
                   ┌──────────────────────────────┐
                   │   Controlled Agent Runtime   │
                   │            (CAR)             │
                   └──────────────┬───────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐        ┌────────────────┐        ┌─────────────────┐
│ Task State    │        │ State Ledger   │        │ Execution       │
│ Machine       │        │                │        │ Journal         │
│               │        │ verified truth │        │ chronological   │
│ lifecycle     │        │ + evidence     │        │ history         │
└──────┬────────┘        └────────┬───────┘        └────────┬────────┘
       │                          │                         │
       └──────────────┬───────────┴────────────┬────────────┘
                      │                        │
                      ▼                        ▼
             ┌────────────────┐       ┌────────────────────┐
             │ Verification   │       │ Completion         │
             │ Engine         │       │ Firewall           │
             │                │       │                    │
             │ build / test / │       │ blocks fake done   │
             │ e2e / guards   │       │ until evidence     │
             └────────────────┘       └────────────────────┘
```

---

## Runtime Truth Model

Heidi separates runtime truth into explicit ownership domains.

| Component | Owns | Does not own |
| :--- | :--- | :--- |
| **Task State Machine** | lifecycle state, transitions, repair count | evidence, history |
| **State Ledger** | verified evidence and durable state facts | lifecycle, acceptance policy |
| **Execution Journal** | chronological action history | lifecycle truth, acceptance truth |
| **Verification Engine** | verification results and acceptance status | lifecycle control, evidence storage policy |
| **Completion Firewall** | final completion decision | state, evidence, history |

This separation matters. It prevents the agent from becoming the source of truth about its own success.

---

## Core Reliability Pillars

| Pillar | Mechanism | Outcome |
| :--- | :--- | :--- |
| **Controlled Execution** | task state machine + runtime gates | fewer invalid transitions and uncontrolled actions |
| **Structured Intent** | task interpreter + acceptance criteria | better alignment with user intent |
| **Context Discipline** | repo-aware retrieval + compact task bundles | less drift, less noisy context |
| **Mandatory Planning** | plan compiler + plan quality gate | fewer vague or random edits |
| **Layered Verification** | static + targeted + e2e + regression checks | stronger confidence before completion |
| **Repair Discipline** | bounded repair loops with evidence | better recovery without blind retries |
| **Completion Integrity** | completion firewall + unfinished-task detector | reduced false completion |

---

## Agent Roster

### Heidi — The Reliability Lead
The default runtime-facing agent. Heidi operates inside CAR and is optimized for controlled task execution, verification-aware progress, and disciplined completion.

### Sisyphus — The Orchestrator
Breaks large goals into dependency-aware plans and structured work units.

### Hephaestus — The Deep Worker
Focuses on implementation-heavy tasks, code exploration, and high-fidelity execution.

### Prometheus — The Strategic Verifier
Focuses on edge cases, alignment checks, and validating whether the result actually satisfies the user’s intent.

---

## Features

### Controlled Agent Runtime
- mandatory interpret → retrieve → plan → execute → verify → repair → complete flow
- hard runtime gates at state, tool, and completion boundaries
- structured task ownership and explicit lifecycle control

### Completion Firewall
- blocks fake completion
- prevents raw language from promoting tasks to DONE
- requires verification evidence before completion

### Repo-Aware Retrieval
- retrieves relevant files, neighbors, tests, config, and recent repo history
- avoids broad context stuffing
- improves task focus and reduces drift

### Mandatory Planning
- requires concrete plans before execution
- rejects vague plans
- ties execution to explicit targets and verification steps

### Layered Verification
- static checks
- targeted behavior checks
- end-to-end verification
- regression guards

### Structured Repair Loops
- classifies failure type
- retries with evidence
- bounded repair count
- explicit BLOCKED state when repair is exhausted

### Runtime Journaling
- durable state/evidence through State Ledger
- chronological history through Execution Journal
- auditable task records and verification trails

---

## Installation

### via npm
```bash
npm install -g @heidi-dang/oh-my-opencode
```

### from source
```bash
git clone https://github.com/heidi-dang/oh-my-opencode.git
cd oh-my-opencode
bun install
bun run build
```

---

## Quick Start

### initialize Heidi
```bash
oh-my-opencode init
```

### run a controlled task
```bash
oh-my-opencode run "Improve the authentication flow with JWT"
```

### run with a more specific engineering task
```bash
oh-my-opencode run "Find why the session page refreshes repeatedly and fix it without breaking completion flow"
```

### inspect runtime status
```bash
oh-my-opencode status
```

> [!NOTE]
> Command names may vary slightly depending on the current CLI surface of your fork.

---

## Configuration

Example top-level configuration:

```json
{
  "runtime": {
    "controlled_agent_runtime": true,
    "max_repair_loops": 3,
    "verification": {
      "static": true,
      "targeted": true,
      "e2e": true,
      "regression": true
    }
  },
  "agents": {
    "default": "heidi"
  },
  "context": {
    "repo_aware_retrieval": true,
    "compact_bundle_limit": 8
  }
}
```

### recommended defaults
- Controlled Agent Runtime enabled
- bounded repair loops enabled
- completion firewall enabled
- unfinished-task detector enabled
- repo-aware retrieval enabled
- diff verification enabled

---

## How Heidi Executes Work

When a task arrives, Heidi does not immediately start editing files. Instead, the runtime moves through a controlled sequence:

1. **Interpret**: Extract the goal, constraints, likely file areas, acceptance criteria, and ambiguity.
2. **Retrieve**: Build a compact task bundle from relevant source files, tests, config, and recent changes.
3. **Plan**: Generate a concrete plan with targets, actions, verification path, and rollback strategy.
4. **Execute**: Apply changes through runtime-gated tools.
5. **Verify**: Run layered checks and collect structured results.
6. **Repair if needed**: Retry using explicit failure evidence, not a blind restart.
7. **Complete only if allowed**: The completion firewall decides whether the task may become DONE.

---

## Verification Model

Heidi uses layered verification to reduce false confidence.

- **Level 1 — Static**: build, lint, typecheck, schema/config validation
- **Level 2 — Targeted**: focused tests for touched features, bug reproduction checks, command-based validation
- **Level 3 — End-to-End**: real usage path verification, workflow-level checks, runtime interaction checks
- **Level 4 — Regression**: doctor checks, snapshot stability, leak detection, task integrity checks

Verification returns structured results rather than prose, making retries and completion gating more reliable.

---

## Completion Firewall

The completion firewall is one of the core differences between Heidi and typical prompt-driven agents. **A task cannot be marked complete just because the model says it is complete.**

Completion is blocked unless:
- lifecycle state is valid
- acceptance criteria are satisfied
- verification results pass
- unfinished-task detection passes
- runtime evidence exists in the ledger

This reduces false done claims and makes success harder to fake.

---

## Project Structure

```text
src/
├── agents/
│   ├── heidi.ts
│   ├── sisyphus/
│   ├── hephaestus/
│   └── prometheus/
├── features/
│   ├── controlled-agent-runtime/
│   │   ├── types.ts
│   │   ├── task-state-machine.ts
│   │   ├── task-interpreter.ts
│   │   ├── context-retriever.ts
│   │   ├── plan-quality-gate.ts
│   │   ├── verification-engine.ts
│   │   ├── diff-verifier.ts
│   │   ├── acceptance-scorer.ts
│   │   ├── unfinished-detector.ts
│   │   ├── task-record.ts
│   │   └── telemetry.ts
│   └── self-healing/
├── hooks/
│   ├── car-orchestrator/
│   └── ...
├── runtime/
│   ├── tools/
│   ├── plan-compiler.ts
│   └── ...
└── ...
```

*Note: Exact file layout may evolve, but the CAR modules should remain explicit and isolated.*

---

## Development

### install dependencies
```bash
bun install
```

### run typecheck
```bash
bun run typecheck
```

### build
```bash
bun run build
```

### test
```bash
bun test
```

### run doctor checks
```bash
python3 tools/doctor.py
```

### local engineering workflow
Recommended workflow for contributors:
1. sync latest main
2. create a focused branch
3. make bounded changes
4. run typecheck, build, tests, and doctor
5. verify the user journey, not just unit tests
6. open a focused PR with evidence

---

## Roadmap

### current priorities
- complete CAR rollout across runtime boundaries
- improve structured retrieval quality
- strengthen verification depth
- reduce false completion further
- harden root repo hygiene and developer workflow rules
- remove reliance on weak prompt-only behavior

### next-stage work
- benchmark-driven tuning
- repo-scoped failure signature memory
- stronger task telemetry and evaluation harness
- local sandbox improvements
- richer diff-aware repair classification

---

## Philosophy

Heidi is built on one core belief: **Agent reliability should come from runtime control, verification, and state discipline — not from hoping the model behaves.**

Heidi is not a chatbot with tools attached. Heidi is a **reliability-oriented agent runtime**.

---

## Contributing

Contributions are welcome, but the project expects disciplined engineering:
- no vague fixes
- no fake completion claims
- no throwaway root scripts
- no unrelated diff pollution
- no “tests pass” claims without actual evidence

Keep PRs focused. Keep runtime behavior measurable. Keep the repo clean.

---

## License

This repository is licensed under **SUL-1.0**. See [LICENSE.md](LICENSE.md) for details.

---

## Acknowledgments

Heidi builds on open agentic primitives and pushes them toward stronger runtime control, stricter completion integrity, and more auditable execution.

If you are building agents and care about reliability, discipline, and measurable completion, this project is for you.

---

<div align="center">
  Made with 🌙 by Heidi & the Antigravity Team
</div>
