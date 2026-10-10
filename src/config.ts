import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

const configSchema = z.object({
  apiBaseUrl: z.string().url().default("https://api.munition.io"),
  accountId: z.string().min(1).optional(),
  accountToken: z.string().min(1).optional(),
}).refine(c => (c.accountId === undefined) === (c.accountToken === undefined), {
  message: "Incomplete account credentials; preserve the config and restore the missing credential before retrying.",
});

export type MunitionConfig = z.infer<typeof configSchema>;

function configPath(): string {
  return process.env.MUNITION_CONFIG ?? join(homedir(), ".munition", "config.json");
}

export async function loadConfig(): Promise<MunitionConfig> {
  const path = configPath();
  let fromFile: Record<string, unknown> = {};
  try {
    const text = await readFile(path, "utf8");
    fromFile = z.record(z.unknown()).parse(JSON.parse(text));
  } catch (error) {
    // Only a missing file is a fresh install. Never overwrite unreadable or
    // corrupt account state by silently falling back to a new account.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const env = (k: string): string | undefined => process.env[k];
  return configSchema.parse({
    apiBaseUrl: env("MUNITION_API_URL") ?? fromFile.apiBaseUrl,
    accountId: fromFile.accountId,
    accountToken: fromFile.accountToken,
  });
}

export async function saveConfig(c: MunitionConfig): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(c, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
}
