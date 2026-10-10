import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ApiClient } from "../client.js";

export const flightOfferDetailsInputSchema = z.object({
  offerId: z.string().trim().min(1).max(256).describe("Duffel offer id, for example off_0000A3bQ8FJj5aa6HYwq0Q"),
});
export type FlightOfferDetailsInput = z.infer<typeof flightOfferDetailsInputSchema>;

export type FlightOfferDetailsSegment = {
  departure: { airportCode?: string; at?: string };
  arrival: { airportCode?: string; at?: string };
  carrierCode?: string;
  operatingCarrierCode?: string;
  flightNumber?: string;
  aircraft?: string;
  duration?: string;
  cabin?: "economy" | "premium_economy" | "business" | "first";
  cabinMarketingName?: string;
};

export type FlightOfferDetailsOutput = {
  id: string;
  totalPrice: string;
  currencyCode: string;
  validatingAirlineCodes: string[];
  itineraries: Array<{
    duration?: string;
    numberOfStops: number;
    segments: FlightOfferDetailsSegment[];
    conditions?: { description?: string };
  }>;
  baggageAllowance: { carryOn?: number; checked?: number };
  fareConditions: {
    changeable?: boolean;
    refundable?: boolean;
    changePenaltyAmount?: string;
    changePenaltyCurrency?: string;
    refundPenaltyAmount?: string;
    refundPenaltyCurrency?: string;
    supportedPassengerIdentityDocumentTypes?: string[];
  };
  cabin?: "economy" | "premium_economy" | "business" | "first";
  conditions: { description?: string };
  searchedAt: string;
};

export const flightOfferDetailsToolDefinition = {
  name: "flight_offer_details",
  description: "Fetch normalized Duffel details for a single flight offer id. Costs 0.01 USDC via x402 from the account wallet.",
  inputSchema: {
    type: "object",
    properties: {
      offerId: {
        type: "string",
        minLength: 1,
        maxLength: 256,
        description: "Duffel offer id, for example off_0000A3bQ8FJj5aa6HYwq0Q",
      },
    },
    required: ["offerId"],
    additionalProperties: false,
  },
} as const;

export async function flightOfferDetailsCall(api: ApiClient, input: FlightOfferDetailsInput): Promise<FlightOfferDetailsOutput> {
  const url = new URL(`${api.apiBaseUrl}/v1/tools/flight-offer-details`);
  url.searchParams.set("offer_id", input.offerId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "idempotency-key": randomUUID(),
      ...api.authHeader(),
    },
  });
  if (!res.ok) throw new Error(`flight_offer_details failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as FlightOfferDetailsOutput;
}
