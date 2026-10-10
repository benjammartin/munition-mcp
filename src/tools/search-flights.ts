import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ApiClient } from "../client.js";

export const searchFlightsInputSchema = z.object({
  origin: z.string().trim().min(3).max(3).transform(value => value.toUpperCase()).describe("IATA origin airport code, e.g. SFO"),
  destination: z.string().trim().min(3).max(3).transform(value => value.toUpperCase()).describe("IATA destination airport code, e.g. JFK"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date as YYYY-MM-DD"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional return date as YYYY-MM-DD"),
  adults: z.number().int().min(1).max(9).default(1).describe("Adult passengers, default 1"),
  children: z.number().int().min(0).max(9).default(0).describe("Child passengers, default 0"),
  infants: z.number().int().min(0).max(9).default(0).describe("Infant passengers without seat, default 0"),
  travelClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
  nonStop: z.boolean().optional().describe("When true, return non-stop offers only"),
  maxResults: z.number().int().positive().max(50).default(50),
  maxPrice: z.number().positive().optional().describe("Optional max total price filter; no currency conversion is applied"),
  currency: z.string().trim().length(3).transform(value => value.toUpperCase()).optional().describe("Optional 3-letter currency code for maxPrice comparison"),
});
export type SearchFlightsInput = z.infer<typeof searchFlightsInputSchema>;

export type FlightSegment = {
  departure: { airportCode?: string; at?: string };
  arrival: { airportCode?: string; at?: string };
  carrierCode?: string;
  operatingCarrierCode?: string;
  flightNumber?: string;
  aircraft?: string;
  duration?: string;
};

export type SearchFlightsOutput = {
  results: Array<{
    id: string;
    source: "flight_search";
    totalPrice: string;
    currency: string;
    airlineCodes: string[];
    itineraries: Array<{
      duration?: string;
      numberOfStops: number;
      segments: FlightSegment[];
    }>;
  }>;
  meta: { resultCount: number; searchedAt: string };
  warnings?: string[];
  run?: { id: string; receiptUrl: string; feedbackUrl: string; pageUrl: string };
};

export const searchFlightsToolDefinition = {
  name: "search_flights",
  description: "Search live flight offers and return normalized itineraries. Costs 0.05 USDC via x402 from the account wallet.",
  inputSchema: {
    type: "object",
    properties: {
      origin: { type: "string", minLength: 3, maxLength: 3, description: "IATA origin airport code, e.g. SFO" },
      destination: { type: "string", minLength: 3, maxLength: 3, description: "IATA destination airport code, e.g. JFK" },
      departureDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Departure date as YYYY-MM-DD" },
      returnDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Optional return date as YYYY-MM-DD" },
      adults: { type: "number", minimum: 1, maximum: 9, default: 1 },
      children: { type: "number", minimum: 0, maximum: 9, default: 0 },
      infants: { type: "number", minimum: 0, maximum: 9, default: 0 },
      travelClass: { type: "string", enum: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"], default: "ECONOMY" },
      nonStop: { type: "boolean", description: "When true, return non-stop offers only" },
      maxResults: { type: "number", minimum: 1, maximum: 50, default: 50 },
      maxPrice: { type: "number", exclusiveMinimum: 0, description: "Optional max total price filter; no currency conversion is applied" },
      currency: { type: "string", minLength: 3, maxLength: 3, description: "Optional 3-letter currency code for maxPrice comparison" },
    },
    required: ["origin", "destination", "departureDate"],
    additionalProperties: false,
  },
} as const;

export async function searchFlightsCall(api: ApiClient, input: SearchFlightsInput): Promise<SearchFlightsOutput> {
  const res = await fetch(`${api.apiBaseUrl}/v1/tools/search-flights`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      ...api.authHeader(),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`search_flights failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as SearchFlightsOutput;
}
