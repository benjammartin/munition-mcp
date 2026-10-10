import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config";

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

async function tmpConfigPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mun-cfg-"));
  return join(dir, "config.json");
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MUNITION_CONFIG;
  delete process.env.MUNITION_API_URL;
});

describe("loadConfig", () => {
  it.each(["EACCES", "EPERM", "EIO"])("propagates %s instead of treating it as a fresh install", async code => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    const error = Object.assign(new Error("Config cannot be read"), { code });
    vi.mocked(fs.readFile).mockRejectedValueOnce(error);
    await expect(loadConfig()).rejects.toBe(error);
  });

  it("uses MUNITION_API_URL for the API base URL", async () => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    process.env.MUNITION_API_URL = "https://api.munition.io";

    const config = await loadConfig();

    expect(config.apiBaseUrl).toBe("https://api.munition.io");
  });

  it("stores account state under the MUNITION_CONFIG path", async () => {
    const path = await tmpConfigPath();
    process.env.MUNITION_CONFIG = path;
    await writeFile(path, JSON.stringify({
      apiBaseUrl: "https://api.example.com",
      accountId: "acct_123",
      accountToken: "mxt_secret",
    }));

    const config = await loadConfig();

    expect(config.accountId).toBe("acct_123");
    expect(config.accountToken).toBe("mxt_secret");
  });
});
