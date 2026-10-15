# Local runtime evidence

This directory is intentionally excluded from Git.

Bug-to-Proof writes browser traces, screenshots, generated tests, provider diagnostics, run records, isolated workspaces, logs, and proof bundles here. Those files can be large and may contain local paths or externally generated content, so they are not suitable for a public repository.

Generate fresh evidence with the repository scripts. Use `npm run artifacts:clean` for a dry-run cleanup report; add `-- --force` only when you intentionally want to remove disposable local output.

Sanitized, reviewable evidence summaries belong in [`docs/evidence/`](../docs/evidence/).
