# Complete Strategy A (P0 gaps + P1–P3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or execute sequentially with TDD.

**Goal:** Close P0 architectural gaps and deliver P1–P3 in this repo’s Fleet plane + Core overlay.

**Architecture:**
- Keep Munder shell; no AionUi rebrand; no Multica vendor; no solo/distributed enum.
- Fleet remains protocol rewrite. Persist with SQLite. Unified HTTP gateway proxies AionCore auth/health when Core is up.
- Worker executes real local subprocess work on claim (stub CLI runner).
- AionCore overlay (`overlays/aioncore-fleet/`) + apply script for fork merge path.
- P1 DecisionGate + Michael inbox; P2 multi-runtime/claim caps; P3 logs + hive import + tunnel docs.

---

### Task 1: Persist Fleet (SQLite) + keep API
### Task 2: Unified gateway (Core JWT/login proxy + loopback freeze)
### Task 3: Worker “干活” (claim → subprocess → complete → Michael)
### Task 4: DecisionGate (P1) + Michael inbox events
### Task 5: Multi-runtime / heartbeat / manual+auto claim caps (P2)
### Task 6: Execution log + hive import + tunnel doc (P3)
### Task 7: AionCore overlay + apply/verify scripts
### Task 8: Docs, tests, demo, PR update
