import type { MunitionConfig } from "./config.js";

export type ApiClient = {
  apiBaseUrl: string;
  authHeader: () => Record<string, string>;
};

// Bumped in lockstep with LATEST_MCP_VERSION in
// packages/server/src/lib/version.ts. The server stamps every response with
// the latest version it was built for; if it differs from MCP_VERSION we log
// a soft warning. Below MIN_SUPPORTED_MCP_VERSION the server returns 426.
const MCP_VERSION = "0.0.16";

export function buildClient(config: MunitionConfig): ApiClient {
  if (!config.accountToken) {
    throw new Error("not onboarded — account token missing");
  }
  const token = config.accountToken;
  return {
    apiBaseUrl: config.apiBaseUrl,
    authHeader: () => ({
      authorization: `Bearer ${token}`,
      "x-munitionx402-mcp-version": MCP_VERSION,
    }),
  };
}
