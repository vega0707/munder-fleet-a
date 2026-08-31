# AionCore Fleet Overlay (Strategy A)

Applies Multica-**semantic** Fleet tables into the vendored tree at **`core/`**.

Demo/control-plane behavior for P0–P3 currently also lives in `src/fleet` (TS). Target: implement matching routes inside `core/` and converge the shell onto Core.

## Apply

```bash
npm run overlay:core
# or: ./scripts/apply-fleet-overlay.sh
```

## Rust wiring（本仓 `core/`）

1. Add `aionui-fleet` crate (or module) under `core/crates/`.
2. Expose `/api/fleet/*`; `--local` uses system default user; Web uses existing JWT/CSRF.
3. Port DecisionGate (pending → reject claim/start).
4. Keep Apache-2.0 NOTICE; pin SHA in `docs/VERSIONS.md`; refresh via `./scripts/sync-core.sh`.

## License

AionCore: Apache-2.0. Multica: do **not** copy source — protocol rewrite only.
