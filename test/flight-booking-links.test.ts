import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flightBookingLinksCall, flightBookingLinksToolDefinition } from "../src/tools/flight-booking-links";

const input = { origin: "JFK", destination: "SFO", departureDate: "2026-11-20" };
afterEach(() => vi.unstubAllGlobals());

describe("flight_booking_links MCP tool", () => {
  it("generates new external one-way searches locally with normalized airport codes", () => {
    const fetchMock = vi.fn(() => { throw new Error("Network must not be called"); });
    vi.stubGlobal("fetch", fetchMock);
    expect(flightBookingLinksCall({ ...input, origin: " jfk ", destination: "sfo" })).toEqual({
      kind: "external_flight_search",
      search: input,
      links: [
        { provider: "kayak", label: "Search flights on KAYAK", url: "https://www.kayak.com/flights/JFK-SFO/2026-11-20" },
        { provider: "kiwi", label: "Search flights on Kiwi.com", url: "https://www.kiwi.com/deep?from=JFK&to=SFO&departure=2026-11-20" },
      ],
      notice: "These links start a new search. Confirm travelers, cabin, availability and final price on the external site. They do not reserve a flight or guarantee a previously displayed fare.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves return dates without adding passenger or payment defaults", () => {
    const result = flightBookingLinksCall({ ...input, returnDate: "2026-11-25" });
    expect(result.links.map(link => link.url)).toEqual([
      "https://www.kayak.com/flights/JFK-SFO/2026-11-20/2026-11-25",
      "https://www.kiwi.com/deep?from=JFK&to=SFO&departure=2026-11-20&return=2026-11-25",
    ]);
    expect(result.search).toEqual({ ...input, returnDate: "2026-11-25" });
  });

  it("accepts leap dates and a same-day return deterministically", () => {
    const leap = { ...input, departureDate: "2028-02-29", returnDate: "2028-02-29" };
    expect(flightBookingLinksCall(leap)).toEqual(flightBookingLinksCall(leap));
  });

  it.each([
    { departureDate: "2026-02-29" },
    { departureDate: "2026-04-31" },
    { departureDate: "2026-13-01" },
    { departureDate: "2026-11-00" },
    { departureDate: "2026-1-20" },
    { departureDate: "2026-11-20?redirect=evil" },
    { returnDate: "2026-11-19" },
    { returnDate: "2026-02-30" },
    { destination: "jfk" },
    { origin: "JFK/SFO" },
    { origin: "JFK&to=LAX" },
    { destination: "https://evil.test" },
    { origin: "12A" },
    { origin: "CDG\nLAX" },
    { offerId: "off_test" },
    { passengers: [{ given_name: "Private" }] },
    { adults: 2 },
    { payment: { card: "private" } },
    { url: "https://evil.test" },
  ])("rejects unsafe or unsupported input %j", fields => {
    expect(() => flightBookingLinksCall({ ...input, ...fields })).toThrow();
  });

  it("runs before onboarding", () => {
    const source = readFileSync(join(process.cwd(), "src/index.ts"), "utf8");
    const branch = source.indexOf('req.params.name === "flight_booking_links"');
    expect(branch).toBeGreaterThan(0);
    expect(branch).toBeLessThan(source.indexOf("await loadConfig()"));
    expect(branch).toBeLessThan(source.indexOf("await bootstrapOnboarding(config)"));
    expect(source).toContain("flightBookingLinksToolDefinition,");
    expect(flightBookingLinksToolDefinition.annotations).toEqual({
      readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
    });
  });
});
