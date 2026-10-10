import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapOnboarding } from "../src/onboarding";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  delete process.env.MUNITION_CONFIG;
  vi.unstubAllGlobals();
});

describe("bootstrapOnboarding", () => {
  it("creates an anonymous account and persists the token", async () => {
    const dir = await mkdtemp(join(tmpdir(), "munition-mcp-"));
    process.env.MUNITION_CONFIG = join(dir, "config.json");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      accountId: "acct_123",
      accountToken: "mxt_secret",
    }), { status: 200 }));

    const result = await bootstrapOnboarding({ apiBaseUrl: "https://api.example.com" });

    expect(result.ready).toBe(true);
    expect(result.config.accountId).toBe("acct_123");
    expect(result.config.accountToken).toBe("mxt_secret");
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/v1/accounts/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const saved = JSON.parse(await readFile(process.env.MUNITION_CONFIG, "utf8"));
    expect(saved.accountToken).toBe("mxt_secret");
    await rm(dir, { recursive: true, force: true });
  });

  it("short-circuits when account credentials already exist", async () => {
    const result = await bootstrapOnboarding({
      apiBaseUrl: "https://api.example.com",
      accountId: "acct_existing",
      accountToken: "mxt_existing",
    });
    expect(result.config.accountId).toBe("acct_existing");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
