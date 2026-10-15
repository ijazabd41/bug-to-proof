# Security policy

## Supported scope

Bug-to-Proof is a local research and portfolio prototype. It is not a hosted service and has no published security-support SLA.

## Reporting a vulnerability

Do not include API keys, provider payloads, private source code, browser traces, or personal data in a public issue. Contact the repository owner privately through the profile associated with the repository and provide only the minimum information needed to reproduce the concern.

## Safe local use

- Keep `.env` files and provider credentials outside Git.
- Review the configured provider and its data policy before enabling live generation.
- Treat bug reports and model responses as untrusted input.
- Use only the configured local target application.
- Inspect generated candidates and proposal hashes before approval.
- Do not publish the contents of `artifacts/` without a separate sanitization review.

The execution contract rejects arbitrary JavaScript, CSS, XPath, and untrusted selectors, but this prototype should still be run in a disposable development environment rather than against sensitive production systems.
