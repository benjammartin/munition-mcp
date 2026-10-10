import { describe, expect, it } from "vitest";
import { buildClient } from "../src/client";

describe("buildClient", () => {
  it("uses the anonymous account token as bearer auth", () => {
    const api = buildClient({
      apiBaseUrl: "https://api.example.com",
      accountId: "acct_123",
      accountToken: "mxt_secret",
    });
    expect(api.apiBaseUrl).toBe("https://api.example.com");
    expect(api.authHeader()).toEqual({
      authorization: "Bearer mxt_secret",
      "x-munitionx402-mcp-version": "0.0.16",
    });
  });

  it("throws when the account token is missing", () => {
    expect(() => buildClient({ apiBaseUrl: "https://api.example.com" }))
      .toThrow(/account token missing/i);
  });
});
