---
"@vercel/sandbox": minor
"sandbox": minor
---

Add 1Password integration: resolve `op://` refs in `integrations.onePassword.secrets` when creating sandboxes and running commands; `env` is merged without resolving `op://`. CLI `sandbox exec --env` still resolves `op://` via `resolveOpSecretsInEnv`.
