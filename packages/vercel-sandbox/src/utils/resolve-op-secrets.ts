import { VERSION } from "../version";
/**
 * Resolves 1Password secret references (op://vault/item/field) in environment
 * variable values using the 1Password JavaScript SDK.
 *
 * @see https://github.com/1Password/onepassword-sdk-js
 * @see https://developer.1password.com/docs/sdks/load-secrets/
 */

const OP_REF_PREFIX = "op://";

function isOpReference(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith(OP_REF_PREFIX);
}
/**
 * Resolves any env values that are 1Password secret references (op://...).
 * Returns a new record with those values replaced by resolved secrets; non-op values are copied over.
 * Requires 1Password auth (OP_SERVICE_ACCOUNT_TOKEN or 1Password desktop app with DesktopAuth).
 *
 * @param env - Record of env var names to values; values that are op:// refs are resolved
 * @param integrationVersion - Version string for the 1Password SDK integration (e.g. "v2.4.0")
 * @returns A new record with op:// values replaced by resolved secrets; returns env unchanged if no refs are found.
 * @throws If an op:// reference cannot be resolved (e.g. missing auth, vault/item/field not found)
 */
export async function resolveOpSecretsInEnv(
  env: Record<string, string>,
  integrationVersion?: string,
): Promise<Record<string, string>> {
  const integrationVersionToUse = integrationVersion ?? `v${VERSION}`;
  const refs = new Map<string, string>();
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && isOpReference(value)) {
      refs.set(key, value.trim());
    }
  }

  if (refs.size === 0) {
    return env;
  }

  const sdk = await import("@1password/sdk");
  const auth =
    process.env.OP_SERVICE_ACCOUNT_TOKEN ??
    (process.env.OP_ACCOUNT
      ? new sdk.DesktopAuth(process.env.OP_ACCOUNT)
      : undefined);

  if (!auth) {
    const refList = [...refs.values()].join(", ");
    throw new Error(
      [
        `Environment contains 1Password secret reference(s) (op://...) but 1Password is not configured.`,
        `  References: ${refList}`,
        `  Set OP_SERVICE_ACCOUNT_TOKEN or OP_ACCOUNT (for desktop app) to resolve secrets.`,
      ].join("\n"),
    );
  }

  const client = await sdk.createClient({
    auth,
    integrationName: "Vercel Sandbox",
    integrationVersion: integrationVersionToUse,
  });

  const result = { ...env };
  for (const [key, ref] of refs) {
    try {
      sdk.Secrets.validateSecretReference(ref);
      result[key] = await client.secrets.resolve(ref);
    } catch (err) {
      throw new Error(`Failed to resolve 1Password reference "${ref}" (${key})`, {
        cause: err,
      });
    }
  }

  return result;
}
