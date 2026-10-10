import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { balanceCall } from "../src/tools/balance";
import { topupLinkCall } from "../src/tools/topup-link";
import { setupLinkCall } from "../src/tools/setup-link";
import type { MunitionConfig } from "../src/config";

const fetchMock = vi.fn();
const originalMunitionApiUrl = process.env.MUNITION_API_URL;
const originalMunitionConfig = process.env.MUNITION_CONFIG;

async function tmpConfigPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mun-cfg-"));
  return join(dir, "config.json");
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  delete process.env.MUNITION_API_URL;
});

afterEach(() => {
  if (originalMunitionConfig === undefined) delete process.env.MUNITION_CONFIG;
  else process.env.MUNITION_CONFIG = originalMunitionConfig;
  if (originalMunitionApiUrl === undefined) {
    delete process.env.MUNITION_API_URL;
  } else {
    process.env.MUNITION_API_URL = originalMunitionApiUrl;
  }
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

const api = {
  apiBaseUrl: "http://api.test",
  authHeader: () => ({ authorization: "Bearer mxt_secret" }),
};

describe("balanceCall", () => {
  it("GETs /v1/account/balance and returns the USDC wallet balance", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accountId: "acct_1",
        currency: "USDC",
        network: "base",
        walletAddress: "0x1111111111111111111111111111111111111111",
        balanceUsdcAtomic: "12345000",
        balanceUsdc: "12.345",
      }),
    );

    const result = await balanceCall(api);
    expect(result.balanceUsdc).toBe("12.345");
    expect(result.currency).toBe("USDC");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/v1/account/balance");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer mxt_secret");
  });

  it("throws when the response is not OK", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    await expect(balanceCall(api)).rejects.toThrow(/balance failed 500/);
  });
});

describe("topupLinkCall", () => {
  it("POSTs /v1/account/topup-link and returns { url }", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: "https://web.example.com/deposit/0x1111111111111111111111111111111111111111?network=base" }));
    const result = await topupLinkCall(api);
    expect(result).toEqual({ url: "https://web.example.com/deposit/0x1111111111111111111111111111111111111111?network=base" });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/v1/account/topup-link");
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });
});

describe("setupLinkCall", () => {
  it("reuses existing credentials without rewriting the config", async () => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    const { saveConfig, loadConfig } = await import("../src/config");
    const seed: MunitionConfig = {
      apiBaseUrl: "http://api.test",
      accountId: "old",
      accountToken: "mxt_old",
    };
    await saveConfig(seed);

    const before = await readFile(process.env.MUNITION_CONFIG, "utf8");
    fetchMock.mockImplementation(async () => jsonResponse({ url: "https://web.example.com/deposit/existing" }));

    expect(await setupLinkCall()).toEqual({ link: "https://web.example.com/deposit/existing" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/v1/account/topup-link");
    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBe("Bearer mxt_old");
    expect(await loadConfig()).toEqual(seed);
    expect(await readFile(process.env.MUNITION_CONFIG, "utf8")).toBe(before);
    expect(await setupLinkCall()).toEqual({ link: "https://web.example.com/deposit/existing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe("http://api.test/v1/account/topup-link");
    expect(await readFile(process.env.MUNITION_CONFIG, "utf8")).toBe(before);
  });

  it.each([
    "{broken", "null", "[]", "42", '"text"',
    '{"accountId":"old"}', '{"accountToken":"mxt_old"}',
    '{"accountId":"","accountToken":""}',
    '{"accountId":123,"accountToken":"mxt_old"}',
  ])("fails closed without network or writes for invalid config %s", async text => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    await writeFile(process.env.MUNITION_CONFIG, text);
    await expect(setupLinkCall()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await readFile(process.env.MUNITION_CONFIG, "utf8")).toBe(text);
  });

  it("fails closed for an unreadable config path (not ENOENT)", async () => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    await mkdir(process.env.MUNITION_CONFIG);
    await expect(setupLinkCall()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await stat(process.env.MUNITION_CONFIG)).isDirectory()).toBe(true);
  });

  it.each([401, 500])("preserves an existing account when topup fails with %s", async status => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    const text = JSON.stringify({ apiBaseUrl: "http://api.test", accountId: "old", accountToken: "mxt_old", extra: "preserve" });
    await writeFile(process.env.MUNITION_CONFIG, text);
    fetchMock.mockResolvedValue(new Response("failed", { status }));
    await expect(setupLinkCall()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/v1/account/topup-link");
    expect(await readFile(process.env.MUNITION_CONFIG, "utf8")).toBe(text);
  });

  it.each(["http", "network", "invalid-json", "invalid-credentials"])("preserves existing config on bootstrap failure: %s", async failure => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    const text = '{ "apiBaseUrl": "http://api.test", "extra": "preserve" }';
    await writeFile(process.env.MUNITION_CONFIG, text);
    if (failure === "network") fetchMock.mockRejectedValue(new Error("offline"));
    else if (failure === "http") fetchMock.mockResolvedValue(new Response("failed", { status: 500 }));
    else if (failure === "invalid-json") fetchMock.mockResolvedValue(new Response("not-json"));
    else fetchMock.mockResolvedValue(jsonResponse({ accountId: "new", accountToken: "" }));
    await expect(setupLinkCall()).rejects.toThrow();
    expect(await readFile(process.env.MUNITION_CONFIG, "utf8")).toBe(text);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not create a config when fresh bootstrap fails", async () => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(setupLinkCall()).rejects.toThrow("offline");
    await expect(readFile(process.env.MUNITION_CONFIG)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("starts fresh when no config file exists yet", async () => {
    process.env.MUNITION_CONFIG = await tmpConfigPath();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ accountId: "acct_x", accountToken: "mxt_x" }))
      .mockResolvedValueOnce(jsonResponse({ url: "https://web.example.com/deposit/0x1111111111111111111111111111111111111111?network=base" }));

    const result = await setupLinkCall();
    expect(result.link).toBe("https://web.example.com/deposit/0x1111111111111111111111111111111111111111?network=base");

    const parsed = JSON.parse(await readFile(process.env.MUNITION_CONFIG, "utf8")) as MunitionConfig;
    expect(parsed.accountId).toBe("acct_x");
    expect(parsed.accountToken).toBe("mxt_x");
  });
});
