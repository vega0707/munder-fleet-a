# P0 Fleet Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Strategy A P0 DoD — AionCore health/JWT verified, Fleet types + local auto-register + claim→complete demo, minimal Munder shell (loopback免登 / Web 登录 stub).

**Architecture:** Multica-semantic Fleet control plane lives in this repo `src/` as a protocol rewrite (not Multica source). It talks to AionCore for health/JWT verification. Long-term merge into AionCore fork is recorded in DECISIONS; P0 does not vendor Multica or replace Munder with AionUi.

**Tech Stack:** Node/TypeScript (node:test), AionCore (Rust, `--local` + JWT paths), static HTML/CSS/JS shell.

---

### Task 1: Pin versions + DECISIONS

- [ ] Copy `refs/VERSIONS.md` → `docs/VERSIONS.md` (commitable pin)
- [ ] Add DECISION: P0 Fleet plane in `src/` pending Core fork merge
- [ ] Commit

### Task 2: Fleet types + store (TDD)

- [ ] Failing tests for Runtime register, Task claim/complete, PendingDecision
- [ ] Implement store + types
- [ ] Auto-register `runtime:local` when empty

### Task 3: HTTP API + demo script

- [ ] `/api/fleet/*` endpoints + loopback auth bypass header/mode
- [ ] `scripts/demo-p0.sh` claim→work→complete
- [ ] Unit/integration tests green

### Task 4: Minimal Munder shell

- [ ] Task list + pending list; loopback skips login; remote shows login form
- [ ] Brand: Munder

### Task 5: AionCore verify

- [ ] Build `aioncore`, `GET /health`, JWT login path smoke
- [ ] Document how-to in README checkboxes

### Task 6: Docs + PR

- [ ] Update README P0 checkboxes / HANDOFF checklist
- [ ] Push + PR
