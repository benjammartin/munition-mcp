import { z } from "zod";

const airportCode = z.string().trim().transform(value => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3}$/, "Use a three-letter IATA airport code."));
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date.");

export const flightBookingLinksInputSchema = z.object({
  origin: airportCode,
  destination: airportCode,
  departureDate: calendarDate,
  returnDate: calendarDate.optional(),
}).strict().superRefine((input, context) => {
  if (input.origin === input.destination) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: "Destination must differ from origin." });
  }
  if (input.returnDate && input.returnDate < input.departureDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["returnDate"], message: "Return date must be on or after departure." });
  }
});

export type FlightBookingLinksInput = z.infer<typeof flightBookingLinksInputSchema>;
export type FlightBookingLinksOutput = {
  kind: "external_flight_search";
  search: FlightBookingLinksInput;
  links: Array<{ provider: "kayak" | "kiwi"; label: string; url: string }>;
  notice: string;
};

export const flightBookingLinksToolDefinition = {
  name: "flight_booking_links",
  description: "Generate KAYAK and Kiwi.com flight search links from airports and dates. Free and local: no account, wallet, API key, or network request is required. These links start a new external search; they do not reserve a flight or convert a Duffel offer ID into the same fare. Confirm travelers, cabin, availability, and final price on the external site.",
  inputSchema: {
    type: "object",
    properties: {
      origin: { type: "string", pattern: "^[A-Za-z]{3}$", description: "Departure IATA airport code, for example JFK." },
      destination: { type: "string", pattern: "^[A-Za-z]{3}$", description: "Arrival IATA airport code, different from origin, for example SFO." },
      departureDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Valid outbound calendar date in YYYY-MM-DD format." },
      returnDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Optional return date in YYYY-MM-DD format, on or after departure." },
    },
    required: ["origin", "destination", "departureDate"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
} as const;

export function flightBookingLinksCall(rawInput: unknown): FlightBookingLinksOutput {
  const search = flightBookingLinksInputSchema.parse(rawInput);
  const kayakUrl = `https://www.kayak.com/flights/${search.origin}-${search.destination}/${search.departureDate}${search.returnDate ? `/${search.returnDate}` : ""}`;
  const kiwiUrl = new URL("https://www.kiwi.com/deep");
  kiwiUrl.searchParams.set("from", search.origin);
  kiwiUrl.searchParams.set("to", search.destination);
  kiwiUrl.searchParams.set("departure", search.departureDate);
  if (search.returnDate) kiwiUrl.searchParams.set("return", search.returnDate);
  return {
    kind: "external_flight_search",
    search,
    links: [
      { provider: "kayak", label: "Search flights on KAYAK", url: kayakUrl },
      { provider: "kiwi", label: "Search flights on Kiwi.com", url: kiwiUrl.toString() },
    ],
    notice: "These links start a new search. Confirm travelers, cabin, availability and final price on the external site. They do not reserve a flight or guarantee a previously displayed fare.",
  };
}
