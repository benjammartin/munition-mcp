import { beforeEach, describe, expect, it, vi } from "vitest";
import { findWebResearchTool, webResearchCall, webResearchToolDefinitions, webResearchTools } from "../src/tools/web-research";
import { renderPdfCall, renderPdfInputSchema, renderPdfToolDefinition } from "../src/tools/render-pdf";
import type { ApiClient } from "../src/client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const api: ApiClient = {
  apiBaseUrl: "https://api.test",
  authHeader: () => ({ authorization: "Bearer acct-token" }),
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("web research MCP tools", () => {
  it("registers the ten account-funded web research tools with prices and server routes", () => {
    expect(webResearchTools.map(tool => [tool.name, tool.path, tool.priceUsdc])).toEqual([
      ["web_search", "/v1/tools/exa-search", "0.01"],
      ["web_find_similar", "/v1/tools/exa-find-similar", "0.01"],
      ["web_contents", "/v1/tools/exa-contents", "0.002"],
      ["web_answer", "/v1/tools/exa-answer", "0.01"],
      ["web_scrape", "/v1/tools/firecrawl-scrape", "0.015"],
      ["web_search_scrape", "/v1/tools/firecrawl-search", "0.03"],
      ["google_search", "/v1/tools/serper-search", "0.004"],
      ["google_news", "/v1/tools/serper-news", "0.004"],
      ["google_images", "/v1/tools/serper-images", "0.004"],
      ["google_shopping", "/v1/tools/serper-shopping", "0.004"],
    ]);
    for (const tool of webResearchToolDefinitions) {
      const meta = findWebResearchTool(tool.name)!;
      expect(tool.description, tool.name).toContain(`Costs ${meta.priceUsdc} USDC per call`);
      expect(tool.inputSchema, tool.name).toMatchObject({ type: "object", additionalProperties: false });
      expect((tool.inputSchema as unknown as { required?: string[] }).required?.length, tool.name).toBeGreaterThan(0);
    }
  });

  it("calls the account-funded route with auth, a fresh idempotency key and the arguments as JSON", async () => {
    const output = { query: "x402", results: [], meta: { resultCount: 0 } };
    fetchMock.mockResolvedValue(jsonResponse(output));

    await expect(webResearchCall(api, "web_search", { query: "x402", numResults: 3 })).resolves.toEqual(output);
    await webResearchCall(api, "google_news", { q: "x402" });

    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/v1/tools/exa-search");
    expect(fetchMock.mock.calls[1]![0]).toBe("https://api.test/v1/tools/serper-news");
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init).toMatchObject({ method: "POST" });
    expect(init.headers).toMatchObject({ "content-type": "application/json", authorization: "Bearer acct-token" });
    expect(String(init.headers["idempotency-key"])).toMatch(/^[0-9a-f-]{36}$/i);
    expect(init.headers["idempotency-key"]).not.toBe(fetchMock.mock.calls[1]![1]!.headers["idempotency-key"]);
    expect(JSON.parse(init.body as string)).toEqual({ query: "x402", numResults: 3 });
  });

  it("rejects non-object arguments locally and surfaces server failures with status and body", async () => {
    await expect(webResearchCall(api, "web_search", "x402")).rejects.toThrow();
    await expect(webResearchCall(api, "not_a_tool", {})).rejects.toThrow(/Unknown web research tool/);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "upstream_failed", paidCallId: "pay_1" } }, 502));
    await expect(webResearchCall(api, "web_scrape", { url: "https://example.com" })).rejects.toThrow(/web_scrape failed 502: .*paidCallId/);
  });
});

describe("render_pdf MCP tool", () => {
  it("registers a priced tool whose schema requires html", () => {
    expect(renderPdfToolDefinition).toMatchObject({
      name: "render_pdf",
      description: expect.stringContaining("0.020 USDC"),
      inputSchema: { type: "object", required: ["html"], additionalProperties: false },
    });
    expect(renderPdfToolDefinition.description).toMatch(/do not pay again/i);
    expect(() => renderPdfInputSchema.parse({})).toThrow();
    expect(() => renderPdfInputSchema.parse({ html: "<h1>x</h1>", extra: true })).toThrow();
    expect(renderPdfInputSchema.parse({ html: "<h1>x</h1>", filename: "r.pdf" })).toEqual({ html: "<h1>x</h1>", filename: "r.pdf" });
  });

  it("posts to /v1/tools/render-pdf with auth and an idempotency key and returns the public URL", async () => {
    const output = { id: "pdf_1", publicUrl: "https://files.test/render/pdf_1-r.pdf", expiresAt: "2026-10-17T00:00:00.000Z", bytes: 10, pages: 1, sha256: "a".repeat(64), renderMs: 5 };
    fetchMock.mockResolvedValueOnce(jsonResponse(output));
    await expect(renderPdfCall(api, { html: "<h1>x</h1>", filename: "r.pdf" })).resolves.toEqual(output);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/v1/tools/render-pdf");
    expect(fetchMock.mock.calls[0]![1]!.headers).toMatchObject({ authorization: "Bearer acct-token" });
    expect(String(fetchMock.mock.calls[0]![1]!.headers["idempotency-key"])).toMatch(/^[0-9a-f-]{36}$/i);

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "render_effect_pending", paidCallId: "pdf_2" } }, 503));
    await expect(renderPdfCall(api, { html: "<h1>x</h1>" })).rejects.toThrow(/render_pdf failed 503: .*render_effect_pending/);
  });
});
