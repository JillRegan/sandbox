import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockResolve,
  mockValidateSecretReference,
  mockCreateClient,
  mockDesktopAuth,
} = vi.hoisted(() => {
  const mockResolve = vi.fn();
  const mockValidateSecretReference = vi.fn();
  const mockCreateClient = vi.fn().mockResolvedValue({
    secrets: { resolve: mockResolve },
  });
  const mockDesktopAuth = vi.fn();
  return {
    mockResolve,
    mockValidateSecretReference,
    mockCreateClient,
    mockDesktopAuth,
  };
});

vi.mock("node:module", async (importOriginal) => {
  const nodeModule = await importOriginal<typeof import("node:module")>();
  return {
    ...nodeModule,
    createRequire: (url: string | URL) => {
      const requireFromUrl = nodeModule.createRequire(url);
      return (id: string) => {
        if (id === "@1password/sdk") {
          return {
            createClient: mockCreateClient,
            DesktopAuth: mockDesktopAuth,
            Secrets: { validateSecretReference: mockValidateSecretReference },
          };
        }
        return requireFromUrl(id);
      };
    },
  };
});

import { mergeEnvWithOnePassword, resolveOpSecretsInEnv } from "./onepassword-env";

describe("resolveOpSecretsInEnv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockResolvedValue("resolved-secret");
    mockValidateSecretReference.mockReturnValue(undefined);
    mockCreateClient.mockResolvedValue({
      secrets: { resolve: mockResolve },
    });
    delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
    delete process.env.OP_ACCOUNT;
  });

  it("returns env unchanged when no op:// refs", async () => {
    const env = { FOO: "plain" };
    const result = await resolveOpSecretsInEnv(env);
    expect(result).toBe(env);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("throws when refs exist but 1Password is not configured", async () => {
    const env = { MY_SECRET: "op://Vault/Item/field" };
    await expect(resolveOpSecretsInEnv(env)).rejects.toThrow(
      "1Password is not configured",
    );
    expect(mockResolve).not.toHaveBeenCalled();
    expect(env.MY_SECRET).toBe("op://Vault/Item/field");
  });

  it("resolves op:// refs when auth is set", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    mockResolve.mockResolvedValue("the-secret");

    const result = await resolveOpSecretsInEnv({
      MY_SECRET: "op://Vault/Item/field",
      OTHER: "plain",
    });

    expect(result).toEqual({ MY_SECRET: "the-secret", OTHER: "plain" });
    expect(mockValidateSecretReference).toHaveBeenCalledWith(
      "op://Vault/Item/field",
    );
    expect(mockResolve).toHaveBeenCalledWith("op://Vault/Item/field");
  });

  it("resolves multiple op:// refs when auth is set", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    mockResolve.mockImplementation((ref: string) =>
      Promise.resolve(
        ref === "op://Vault/A/field" ? "secret-a" : "secret-b",
      ),
    );

    const result = await resolveOpSecretsInEnv({
      FIRST: "op://Vault/A/field",
      SECOND: "op://Vault/B/field",
      PLAIN: "plain-value",
    });

    expect(result).toEqual({
      FIRST: "secret-a",
      SECOND: "secret-b",
      PLAIN: "plain-value",
    });
    expect(mockValidateSecretReference).toHaveBeenCalledWith(
      "op://Vault/A/field",
    );
    expect(mockValidateSecretReference).toHaveBeenCalledWith(
      "op://Vault/B/field",
    );
    expect(mockResolve).toHaveBeenCalledWith("op://Vault/A/field");
    expect(mockResolve).toHaveBeenCalledWith("op://Vault/B/field");
  });
});

describe("mergeEnvWithOnePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve.mockResolvedValue("resolved-secret");
    mockValidateSecretReference.mockReturnValue(undefined);
    mockCreateClient.mockResolvedValue({
      secrets: { resolve: mockResolve },
    });
    delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
    delete process.env.OP_ACCOUNT;
  });

  it("returns {} when integrations and env are empty", async () => {
    const result = await mergeEnvWithOnePassword(undefined, undefined);
    expect(result).toEqual({});
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("lets env override integration secrets for the same key", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    mockResolve.mockResolvedValue("from-op");

    const result = await mergeEnvWithOnePassword(
      {
        onePassword: {
          secrets: { MY_SECRET: "op://Vault/Item/field", OTHER: "plain" },
        },
      },
      { MY_SECRET: "from-env" },
    );

    expect(result.MY_SECRET).toBe("from-env");
    expect(result.OTHER).toBe("plain");
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("resolves op:// refs after merge", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    mockResolve.mockResolvedValue("resolved");

    const result = await mergeEnvWithOnePassword(
      {
        onePassword: {
          secrets: { MY_SECRET: "op://Vault/Item/field" },
        },
      },
      { PLAIN: "x" },
    );

    expect(result).toEqual({ MY_SECRET: "resolved", PLAIN: "x" });
    expect(mockResolve).toHaveBeenCalledWith("op://Vault/Item/field");
  });

  it("does not resolve integration op:// for keys overridden by env", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    mockResolve.mockImplementation((ref: string) =>
      Promise.resolve(ref === "op://Vault/B/field" ? "secret-b" : "ignored"),
    );

    const result = await mergeEnvWithOnePassword(
      {
        onePassword: {
          secrets: {
            OVERRIDDEN: "op://Vault/A/field",
            FROM_INTEGRATION: "op://Vault/B/field",
          },
        },
      },
      { OVERRIDDEN: "from-env" },
    );

    expect(result).toEqual({
      OVERRIDDEN: "from-env",
      FROM_INTEGRATION: "secret-b",
    });
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith("op://Vault/B/field");
  });

  it("does not resolve op:// in env (integration-only resolution)", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    const opRef = "op://Vault/Item/field";

    const result = await mergeEnvWithOnePassword(undefined, { FOO: opRef });

    expect(result).toEqual({ FOO: opRef });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("resolves integration op:// but leaves env op:// literal", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "test-token";
    mockResolve.mockResolvedValue("resolved-bar");
    const envOp = "op://Vault/Env/field";

    const result = await mergeEnvWithOnePassword(
      {
        onePassword: {
          secrets: { BAR: "op://Vault/Item/field" },
        },
      },
      { FOO: envOp },
    );

    expect(result).toEqual({ FOO: envOp, BAR: "resolved-bar" });
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith("op://Vault/Item/field");
  });
});
