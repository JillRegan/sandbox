# 1Password Environments Example

This example demonstrates how to load sandbox environment variables from a 1Password Environment (beta). It creates a sandbox with `env.from1PasswordEnvironment`, runs a command that checks the injected vars (by length only, without printing secrets), and then stops the sandbox.

## Features

- **1Password Environment**: Pass a 1Password Environment ID in `env.from1PasswordEnvironment` when creating a sandbox
- **Environment Injection**: All variables from that Environment are loaded, any `op://` refs are resolved, and the result is merged into the environment for every command
- **Optional Env Var**: Read the Environment ID from `OP_ENVIRONMENT_ID` in `.env.local` so you don't hardcode it in code
- **Authentication**: Uses `OP_SERVICE_ACCOUNT_TOKEN` or `OP_ACCOUNT` (desktop app) for 1Password

## Prerequisites

1. **Create a 1Password Environment**: Create an [Environment in 1Password](https://developer.1password.com/docs/environments/) (Developer → View Environments → Create Environment) and add the variables you want in the sandbox.
   1. Add **`OP_REF`** as a 1Password secret reference (e.g. `op://Vault/Item/field`).
   2. Add **`PLAIN_SECRET`** as a plain text string (no `op://`).
    The example script will then print the length of each. The `op://` reference in `OP_REF` is resolved to the secret value before the script runs, so the printed length is for the resolved secret, not the reference string.

2. **Create a service account**: Use a [1Password service account](https://developer.1password.com/docs/service-accounts/) so the sandbox can read that Environment.
   1. Create a service account in 1Password.
   2. Grant it access to the Environment you created in step 1.
   3. Copy its token; you’ll add it as `OP_SERVICE_ACCOUNT_TOKEN` in the “How to Run” section below.


## How to Run

1. Navigate to the example directory:
```bash
   cd examples/onepassword-enviornments
```

2. Install dependencies:
```bash
   pnpm install
```

3. Set up authentication for Vercel Sandbox:
```bash
   vercel link
   vercel env pull
```

4. Set up 1Password: add OP_SERVICE_ACCOUNT_TOKEN (or OP_ACCOUNT for desktop app) to .env.local. See [Prerequisites](#prerequisites) above.
```bash
    OP_SERVICE_ACCOUNT_TOKEN="your-token"
```

5. Add your 1Password Environment ID. See [Prerequisites](#prerequisites) above.
```bash
   OP_ENVIRONMENT_ID="your-environment-id"
```

6. Run the example:
```bash
   pnpm start
```

**Expected output**

You should see output like:

- `Creating sandbox with 1Password Environment...`
- `Sandbox ID: ...`
- `OP_REF length: ...` and `PLAIN_SECRET length: ...` (non-zero if those vars are set in your Environment)
- `Done.`

If lengths are 0 or you see errors, check that `OP_ENVIRONMENT_ID` and `OP_SERVICE_ACCOUNT_TOKEN` are set correctly in `.env.local` and that your service account has access to the Environment and that the Environment contains `OP_REF` and `PLAIN_SECRET`.
