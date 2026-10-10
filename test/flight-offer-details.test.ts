import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flightOfferDetailsCall, flightOfferDetailsInputSchema, flightOfferDetailsToolDefinition } from "../src/tools/flight-offer-details";
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

const normalizedOfferDetails = {
  id: "off_0000A3bQ8FJj5aa6HYwq0Q",
  totalPrice: "512.30",
  currencyCode: "USD",
  validatingAirlineCodes: ["AF"],
  itineraries: [{
    duration: "PT8H10M",
    numberOfStops: 0,
    segments: [{
      departure: { airportCode: "CDG", at: "2026-09-01T10:00:00" },
      arrival: { airportCode: "JFK", at: "2026-09-01T12:10:00" },
      carrierCode: "AF",
      flightNumber: "006",
      cabin: "economy" as const,
      cabinMarketingName: "Economy",
    }],
  }],
  baggageAllowance: { carryOn: 1, checked: 1 },
  fareConditions: { changeable: true, refundable: false },
  cabin: "economy" as const,
  conditions: { description: "Ticket conditions apply." },
  searchedAt: "2026-05-19T00:00:00.000Z",
};

const indexSourcePath = join(process.cwd(), "src/index.ts");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("flight_offer_details MCP tool", () => {
  it("validates offerId input before any server call", () => {
    expect(flightOfferDetailsInputSchema.parse({ offerId: " off_123 " })).toEqual({ offerId: "off_123" });

    expect(() => flightOfferDetailsInputSchema.parse({ offerId: "" })).toThrow();
    expect(() => flightOfferDetailsInputSchema.parse({ offer_id: "off_123" })).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers an agent-readable MCP tool schema using offerId as the public argument", () => {
    expect(flightOfferDetailsToolDefinition).toMatchObject({
      name: "flight_offer_details",
      description: expect.stringContaining("0.01 USDC"),
      inputSchema: {
        type: "object",
        required: ["offerId"],
        additionalProperties: false,
      },
    });
    expect(flightOfferDetailsToolDefinition.inputSchema.properties.offerId).toMatchObject({
      type: "string",
      minLength: 1,
      maxLength: 256,
    });
  });

  it("is wired into the top-level MCP list and call handlers", () => {
    const indexSource = readFileSync(indexSourcePath, "utf8");

    expect(indexSource).toContain("flightOfferDetailsToolDefinition");
    expect(indexSource).toContain("req.params.name === \"flight_offer_details\"");
    expect(indexSource).toContain("flightOfferDetailsInputSchema.parse(req.params.arguments)");
    expect(indexSource).toContain("flightOfferDetailsCall(api, input)");
  });

  it("calls the account-funded route with auth, an idempotency key, and server query name", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(normalizedOfferDetails));

    await expect(flightOfferDetailsCall(api, { offerId: "off_0000A3bQ8FJj5aa6HYwq0Q" })).resolves.toEqual(normalizedOfferDetails);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/v1/tools/flight-offer-details?offer_id=off_0000A3bQ8FJj5aa6HYwq0Q");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "GET" });
    expect(fetchMock.mock.calls[0]![1]!.headers).toMatchObject({ authorization: "Bearer acct-token" });
    expect(String(fetchMock.mock.calls[0]![1]!.headers["idempotency-key"])).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("surfaces account-funded route failures with status and body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "account_auth_invalid" } }, 401));

    await expect(flightOfferDetailsCall(api, { offerId: "off_123" })).rejects.toThrow(/flight_offer_details failed 401/);
  });
});
