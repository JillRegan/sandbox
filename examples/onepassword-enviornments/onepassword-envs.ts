import { Sandbox } from "@vercel/sandbox";

async function main() {
  const envId = process.env.OP_ENVIRONMENT_ID;
  if (!envId) {
    console.error("Set OP_ENVIRONMENT_ID in .env.local (1Password Environment ID).");
    process.exit(1);
  }

  console.log("Creating sandbox with 1Password Environment...\n");
  const sandbox = await Sandbox.create({
    timeout: 30000,
    env: { from1PasswordEnvironment: envId },
  });

  console.log("Sandbox ID:", sandbox.sandboxId);
  console.log("Running printenv (sample of env vars):\n");

  const result = await sandbox.runCommand("bash", [
    "-c",
    "echo \"OP_REF length: ${#OP_REF}\" && echo \"PLAIN_SECRET length: ${#PLAIN_SECRET}\"",
  ]);
  console.log(await result.stdout());

  await sandbox.stop();
  console.log("\nDone.");
}

main().catch(console.error);
