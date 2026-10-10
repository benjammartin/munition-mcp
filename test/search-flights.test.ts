import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchFlightsCall, searchFlightsInputSchema, searchFlightsToolDefinition } from "../src/tools/search-flights";
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

describe("search_flights MCP tool", () => {
  it("validates input and applies account-funded defaults before any server call", () => {
    expect(searchFlightsInputSchema.parse({
      origin: "cdg",
      destination: "jfk",
      departureDate: "2026-09-01",
    })).toEqual({
      origin: "CDG",
      destination: "JFK",
      departureDate: "2026-09-01",
      adults: 1,
      children: 0,
      infants: 0,
      travelClass: "ECONOMY",
      maxResults: 50,
    });

    expect(() => searchFlightsInputSchema.parse({
      origin: "CD",
      destination: "JFK",
      departureDate: "2026-09-01",
    })).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers an agent-readable MCP tool schema", () => {
    expect(searchFlightsToolDefinition).toMatchObject({
      name: "search_flights",
      description: expect.stringContaining("0.05 USDC"),
      inputSchema: {
        type: "object",
        required: ["origin", "destination", "departureDate"],
        additionalProperties: false,
      },
    });
    expect(searchFlightsToolDefinition.inputSchema.properties.maxResults).toMatchObject({ default: 50, maximum: 50 });
    expect(searchFlightsToolDefinition.inputSchema.properties.nonStop).toMatchObject({ type: "boolean" });
  });

  it("calls the account-funded route with auth and an idempotency key", async () => {
    const output = {
      results: [{
        id: "off_1",
        source: "flight_search" as const,
        totalPrice: "512.30",
        currency: "USD",
        airlineCodes: ["AF"],
        itineraries: [{ numberOfStops: 0, segments: [] }],
      }],
      meta: { resultCount: 1, searchedAt: "2026-05-19T00:00:00.000Z" },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(output));

    await expect(searchFlightsCall(api, {
      origin: "CDG",
      destination: "JFK",
      departureDate: "2026-09-01",
      adults: 1,
      children: 0,
      infants: 0,
      travelClass: "ECONOMY",
      maxResults: 5,
      nonStop: true,
    })).resolves.toEqual(output);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/v1/tools/search-flights");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[0]![1]!.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer acct-token",
    });
    expect(String(fetchMock.mock.calls[0]![1]!.headers["idempotency-key"])).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toMatchObject({
      origin: "CDG",
      destination: "JFK",
      nonStop: true,
      maxResults: 5,
    });
  });

  it("surfaces account-funded route failures with status and body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "account_auth_invalid" } }, 401));

    await expect(searchFlightsCall(api, {
      origin: "CDG",
      destination: "JFK",
      departureDate: "2026-09-01",
      adults: 1,
      children: 0,
      infants: 0,
      travelClass: "ECONOMY",
      maxResults: 5,
    })).rejects.toThrow(/search_flights failed 401/);
  });
});
