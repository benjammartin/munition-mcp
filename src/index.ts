#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { buildClient } from "./client.js";
import { uploadInputSchema, uploadCall } from "./tools/upload.js";
import { searchFlightsCall, searchFlightsInputSchema, searchFlightsToolDefinition } from "./tools/search-flights.js";
import { flightOfferDetailsCall, flightOfferDetailsInputSchema, flightOfferDetailsToolDefinition } from "./tools/flight-offer-details.js";
import { flightBookingLinksCall, flightBookingLinksToolDefinition } from "./tools/flight-booking-links.js";
import { findWebResearchTool, webResearchCall, webResearchToolDefinitions } from "./tools/web-research.js";
import { renderPdfCall, renderPdfInputSchema, renderPdfToolDefinition } from "./tools/render-pdf.js";
import { bootstrapOnboarding } from "./onboarding.js";
import { toolErrorResult } from "./tool-errors.js";

const server = new Server(
  { name: "munition", version: "0.0.16" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "upload",
      description: "Upload a local file (≤ 10 MB) with optional stable tags. Returns a public URL retained for 7 days plus upload metadata including tags. Costs 0.005 USDC via x402.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path to the local file" },
          filename: { type: "string", description: "Optional URL slug" },
          tags: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 64 },
            maxItems: 20,
            description: "Optional stable upload tags for categorization. Returned as an array of strings.",
          },
        },
        required: ["path"],
      },
    },
    searchFlightsToolDefinition,
    flightOfferDetailsToolDefinition,
    flightBookingLinksToolDefinition,
    ...webResearchToolDefinitions,
    renderPdfToolDefinition,
    {
      name: "balance",
      description: "Returns the account's USDC wallet balance for x402 payments.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "topup_link",
      description: "Returns an deposit URL for funding the account x402 wallet with USDC on Base.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "connect_link",
      description: "Return a one-time link (valid 15 minutes) that lets the user use this same Munition account and balance in Claude.ai, ChatGPT or any app connected to the remote MCP server https://api.munition.io/mcp. The user opens it in the browser they will connect from, confirms, then adds or reconnects the connector. Free.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "setup_link",
      description: "Return a deposit link for the existing account, creating an anonymous account only if credentials are absent. Never resets existing credentials.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "renew_upload",
      description: "Extend a file's retention by 7 more days. Costs 0.005 USDC via x402.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "File id" },
        },
        required: ["id"],
      },
    },
    {
      name: "delete_upload",
      description: "Delete a previously-uploaded file. Free.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "File id" },
        },
        required: ["id"],
      },
    },
    {
      name: "recent_uploads",
      description: "List the account's recent uploads (non-deleted), most recent first. Returns id, url, size, mime, hash, originalFilename, tags, uploadedAt, expiresAt, renewalCount, txHash. Free.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max items per page (1-100, default 20)" },
          cursor: { type: "number", description: "Offset for pagination (default 0)" },
        },
      },
    },
  ],
}));

async function handleToolCall(req: { params: { name: string; arguments?: Record<string, unknown> | undefined } }) {
  // Link generation is entirely local and must not create or fund an account.
  if (req.params.name === "flight_booking_links") {
    const result = flightBookingLinksCall(req.params.arguments);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  // setup_link loads and preserves existing account state, bootstrapping only
  // when credentials are absent, then returns its deposit link.
  if (req.params.name === "setup_link") {
    const { setupLinkCall } = await import("./tools/setup-link.js");
    const result = await setupLinkCall();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  // Reload config on every tool call: the MCP stdio process stays alive across
  // calls and first-use onboarding writes to disk, so a snapshot taken at
  // process start would be stale on the next call.
  const config = await loadConfig();
  const onboarding = await bootstrapOnboarding(config);
  const api = buildClient(onboarding.config);

  if (req.params.name === "upload") {
    const input = uploadInputSchema.parse(req.params.arguments);
    const result = await uploadCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "search_flights") {
    const input = searchFlightsInputSchema.parse(req.params.arguments);
    const result = await searchFlightsCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "flight_offer_details") {
    const input = flightOfferDetailsInputSchema.parse(req.params.arguments);
    const result = await flightOfferDetailsCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (findWebResearchTool(req.params.name)) {
    const result = await webResearchCall(api, req.params.name, req.params.arguments);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "render_pdf") {
    const input = renderPdfInputSchema.parse(req.params.arguments);
    const result = await renderPdfCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "balance") {
    const { balanceCall } = await import("./tools/balance.js");
    const result = await balanceCall(api);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "topup_link") {
    const { topupLinkCall } = await import("./tools/topup-link.js");
    const result = await topupLinkCall(api);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "connect_link") {
    const { connectLinkCall } = await import("./tools/connect-link.js");
    const result = await connectLinkCall(api);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "renew_upload") {
    const { renewUploadCall, renewUploadInputSchema } = await import("./tools/renew-upload.js");
    const input = renewUploadInputSchema.parse(req.params.arguments);
    const result = await renewUploadCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "delete_upload") {
    const { deleteUploadCall, deleteUploadInputSchema } = await import("./tools/delete-upload.js");
    const input = deleteUploadInputSchema.parse(req.params.arguments);
    const result = await deleteUploadCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (req.params.name === "recent_uploads") {
    const { recentUploadsCall, recentUploadsInputSchema } = await import("./tools/recent-uploads.js");
    const input = recentUploadsInputSchema.parse(req.params.arguments);
    const result = await recentUploadsCall(api, input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  throw new Error(`Unknown tool: ${req.params.name}`);
}

server.setRequestHandler(CallToolRequestSchema, async req => {
  try {
    return await handleToolCall(req);
  } catch (err) {
    // Return failures as tool results so the model sees the reason (and any top-up link)
    // instead of an opaque JSON-RPC internal error.
    return toolErrorResult(err);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
