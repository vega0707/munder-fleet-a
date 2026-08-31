# AionCore inside munder-fleet-a

This directory vendors [iOfficeAI/AionCore](https://github.com/iOfficeAI/AionCore)
at pin **`9bfb2adbab1aca47bcd1a644446aeee6c41aab4f`** (see `../docs/VERSIONS.md`).

- License: **Apache-2.0** — see `LICENSE` in this directory; retain NOTICE/版权.
- Strategy A monorepo: product home is this repo; Control/Runtime plane lives under `core/`.
- Fleet migrations/docs: `docs/munder-fleet/` + `crates/aionui-db/migrations/044_fleet_*`.
- Do **not** vendor Multica source into this tree.

Refresh from upstream (maintainers):

```bash
./scripts/sync-core.sh
```
