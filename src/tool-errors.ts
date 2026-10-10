/**
 * Converts a failed tool call into an MCP tool result with isError=true.
 *
 * Tool errors carry the HTTP status and JSON body from the Munition API (e.g. `web_search failed 402: {...}`).
 * When the account wallet is short, the API returns `insufficient_funds` with a `topupUrl`; surface it
 * explicitly so the model can hand the link to the human instead of retrying.
 */
export function toolErrorResult(err: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const message = err instanceof Error ? err.message : String(err);
  const lines = [message];
  const jsonStart = message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(message.slice(jsonStart)) as { error?: { code?: string; details?: Record<string, unknown> } };
      const details = body.error?.details ?? {};
      if (body.error?.code === "insufficient_funds" && typeof details.topupUrl === "string") {
        lines.unshift(
          `Insufficient Munition balance: ${String(details.balanceUsdc ?? "0")} USDC available, ${String(details.requiredUsdc ?? "?")} USDC required.`,
          `Ask the user to add funds at ${details.topupUrl} (USDC on Base to ${String(details.walletAddress ?? "the account wallet")}), then retry. Do not retry before funding.`,
        );
      }
    } catch {
      // Non-JSON error body: keep the raw message.
    }
  }
  return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
}
