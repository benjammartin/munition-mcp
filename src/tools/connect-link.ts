import type { ApiClient } from "../client.js";

export type ConnectLinkOutput = { url: string; expiresAt: string; accountId: string };

/**
 * One-time link (15 min) that binds the user's browser to this account, so connecting the remote
 * MCP (https://api.munition.io/mcp, e.g. a Claude.ai custom connector) reuses this account and its balance.
 */
export async function connectLinkCall(api: ApiClient): Promise<ConnectLinkOutput> {
  const res = await fetch(`${api.apiBaseUrl}/v1/account/connect-link`, {
    method: "POST",
    headers: api.authHeader(),
  });
  if (!res.ok) throw new Error(`connect-link failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as ConnectLinkOutput;
}
