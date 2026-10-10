import { describe, expect, it } from "vitest";
import { toolErrorResult } from "../src/tool-errors.js";

describe("toolErrorResult", () => {
  it("surfaces the top-up link for insufficient funds", () => {
    const body = { error: { code: "insufficient_funds", details: { balanceUsdc: "0", requiredUsdc: "0.01", walletAddress: "0xabc", topupUrl: "https://munition.io/deposit/0xabc?network=base" } } };
    const result = toolErrorResult(new Error(`web_search failed 402: ${JSON.stringify(body)}`));
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Insufficient Munition balance: 0 USDC available, 0.01 USDC required.");
    expect(result.content[0]!.text).toContain("https://munition.io/deposit/0xabc?network=base");
  });

  it("keeps other errors verbatim", () => {
    const result = toolErrorResult(new Error("web_search failed 502: upstream"));
    expect(result).toEqual({ content: [{ type: "text", text: "web_search failed 502: upstream" }], isError: true });
  });
});
