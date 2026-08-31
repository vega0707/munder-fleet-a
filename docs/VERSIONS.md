# Pinned upstream HEADs

`core/` vendors AionCore at the pin below (committed).  
`refs/` (gitignored) may mirror other upstreams via `./scripts/bootstrap-forks.sh`.

| Upstream | Short | Full SHA | In-repo |
|----------|-------|----------|---------|
| [AionCore](https://github.com/iOfficeAI/AionCore) | `9bfb2ad` | `9bfb2adbab1aca47bcd1a644446aeee6c41aab4f` | **`core/`** |
| [AionUi](https://github.com/iOfficeAI/AionUi) | `cbabbc8` | `cbabbc8deaceab339e7e5abf0caf790426330c6e` | refs only |
| [aionrs](https://github.com/iOfficeAI/aionrs) | `f711174` | `f7111746015d8e6f960e1568a805ceef975022d3` | refs only |
| [multica](https://github.com/multica-ai/multica) | `1186114` | `11861145abc59a0d39c8c8f24ad837d4584e664f` | refs only（**不 vendor**） |
| [munder-difflin](https://github.com/vega0707/munder-difflin) | `0d52cc7` | `0d52cc7e6ae77103423cdfc31eb0aa4ecd2c3c74` | refs / shell 对照 |

Refresh Core: `./scripts/sync-core.sh`（默认 checkout 上表 AionCore SHA）。
