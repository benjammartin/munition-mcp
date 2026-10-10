import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrices, clearPriceCache, type PricesResponse } from "../src/prices";

const fetchMock = vi.fn();

const samplePrices: PricesResponse = {
  version: "v2",
  validUntil: "2026-12-31T00:00:00Z",
  tools: {
    upload: { amountUsd: 0.005, amountUsdcAtomic: "5000", currency: "USDC", retentionDays: 7 },
    renew: { amountUsd: 0.005, amountUsdcAtomic: "5000", currency: "USDC", extensionDays: 7 },
  },
};

const otherPrices: PricesResponse = {
  ...samplePrices,
  version: "v2",
};

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  clearPriceCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearPriceCache();
});

describe("getPrices", () => {
  it("fetches /v1/tools/prices on first call and caches the result for subsequent calls within TTL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(samplePrices));

    const first = await getPrices("http://api.test");
    const second = await getPrices("http://api.test");

    expect(first).toEqual(samplePrices);
    expect(second).toEqual(samplePrices);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/v1/tools/prices");
  });

  it("re-fetches after the 1h TTL elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T10:00:00Z"));

    fetchMock.mockResolvedValueOnce(jsonResponse(samplePrices));
    await getPrices("http://api.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance just under 1h — still cached.
    vi.setSystemTime(new Date("2026-05-04T10:59:59Z"));
    await getPrices("http://api.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past 1h — refetch.
    vi.setSystemTime(new Date("2026-05-04T11:00:01Z"));
    fetchMock.mockResolvedValueOnce(jsonResponse(otherPrices));
    const refreshed = await getPrices("http://api.test");
    expect(refreshed).toEqual(otherPrices);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("force=true bypasses the cache", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(samplePrices));
    fetchMock.mockResolvedValueOnce(jsonResponse(otherPrices));

    const first = await getPrices("http://api.test");
    const forced = await getPrices("http://api.test", { force: true });

    expect(first).toEqual(samplePrices);
    expect(forced).toEqual(otherPrices);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to stale cache when the network call fails after a successful prime", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(samplePrices));
    await getPrices("http://api.test");

    // Force a refetch that returns 503 — should soft-fall-back to cache.
    fetchMock.mockResolvedValueOnce(textResponse("upstream down", 503));
    const fallback = await getPrices("http://api.test", { force: true });
    expect(fallback).toEqual(samplePrices);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the first fetch fails and there is no cache to fall back to", async () => {
    fetchMock.mockResolvedValueOnce(textResponse("boom", 500));
    await expect(getPrices("http://api.test")).rejects.toThrow(/prices fetch failed: 500/);
  });

  it("clearPriceCache forces a network call on the next request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(samplePrices));
    await getPrices("http://api.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearPriceCache();

    fetchMock.mockResolvedValueOnce(jsonResponse(otherPrices));
    const after = await getPrices("http://api.test");
    expect(after).toEqual(otherPrices);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
