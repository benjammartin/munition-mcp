# @munition/mcp

Munition is a pay-per-use service layer for AI agents. It includes **Upload** (file -> public URL), **Web research** (Exa, Firecrawl and Google/Serper search, page reading and answers), **HTML to PDF**, **Flight Search** (Duffel-backed live offers), and free **Flight Booking Links** for external Kayak and Kiwi searches.

> **No install needed:** Munition is also a remote MCP server. Add `https://api.munition.io/mcp` as a custom connector in Claude, ChatGPT, Cursor or Codex (OAuth, one-click anonymous account). Setup per client: https://munition.io/connect.md
>
> This repository mirrors `packages/mcp` from the Munition monorepo; issues and PRs are welcome here.

> Status: v0.0.16 alpha

## Services

| Service | Cost | Use it when your agent needs to... |
| --- | ---: | --- |
| Upload | 0.005 USDC per upload or renew | Turn a local file into a public URL, keep it for 7 days, renew it, delete it, or list recent uploads. |
| Web research | 0.002–0.03 USDC per call | Search the web, read pages as clean text or markdown, get cited answers, and query Google web, news, images and shopping. |
| HTML to PDF | 0.020 USDC per PDF | Turn a self-contained HTML report into an A4 PDF with a public URL. |
| Flight Search | 0.05 USDC per search | Find live flight offers with prices, airlines, itineraries, and segments. |
| Flight Booking Links | Free | Generate Kayak and Kiwi search URLs from route and dates, without an account or API call. |
| Account | Free | Check wallet balance or create a deposit link. |

Account-backed tools create an anonymous local account when needed. Paid calls settle in USDC on Base through the account's x402 wallet. `flight_booking_links` runs locally without onboarding, a wallet, or payment.

## Install

Munition runs as a local stdio MCP server. Requirements: Node.js 20+ and an MCP client that can run local commands. API-backed tools need network access to `https://api.munition.io`; generating flight search links does not call an API.

### Cursor

<p>
  <a href="https://cursor.com/en/install-mcp?name=munition&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBtdW5pdGlvbi9tY3AiXSwiZW52Ijp7Ik1VTklUSU9OX0FQSV9VUkwiOiJodHRwczovL2FwaS5tdW5pdGlvbi5pbyJ9fQ%3D%3D">
    <img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add Munition MCP server to Cursor" height="32" />
  </a>
</p>

### Claude Code / Codex

```bash
claude mcp add munition --scope user --env MUNITION_API_URL=https://api.munition.io -- npx -y @munition/mcp
# or:
codex mcp add munition --env MUNITION_API_URL=https://api.munition.io -- npx -y @munition/mcp
```

### Manual MCP config

Use this same server definition in Cursor, Claude Desktop, Windsurf, Gemini CLI, or any local stdio MCP client:

```json
{
  "mcpServers": {
    "munition": {
      "command": "npx",
      "args": [
        "-y",
        "@munition/mcp"
      ],
      "env": {
        "MUNITION_API_URL": "https://api.munition.io"
      }
    }
  }
}
```

Restart the MCP client after changing config.

### More clients

Claude Desktop uses the manual JSON above. ChatGPT Web and Claude Web custom connectors require a remote MCP endpoint; this npm package is local stdio, so use Cursor, Claude Code, Codex, Claude Desktop, or another local MCP client for now.

## Tools

| Tool | Cost | What it returns |
| --- | ---: | --- |
| `upload(path, filename?, tags?)` | 0.005 USDC | Public URL plus file metadata. |
| `search_flights(origin, destination, departureDate, ...)` | 0.05 USDC | Live flight offers with prices and itineraries. |
| `web_search(query, numResults?, category?, contents?, ...)` | 0.01 USDC | Exa neural web search; optional page text, highlights or summary. |
| `web_find_similar(url, numResults?, ...)` | 0.01 USDC | Pages similar to a URL (Exa). |
| `web_contents(urls, ...)` | 0.002 USDC | Clean text of up to 20 URLs (Exa). |
| `web_answer(query, text?)` | 0.01 USDC | Direct answer with cited sources (Exa). |
| `web_scrape(url, formats?, ...)` | 0.015 USDC | One URL rendered with JavaScript, as markdown (Firecrawl). |
| `web_search_scrape(query, limit?, scrapeContent?, ...)` | 0.03 USDC | Web search, optionally with each result's markdown (Firecrawl). |
| `google_search(q, gl?, hl?, num?, ...)` | 0.004 USDC | Google web results (Serper). |
| `google_news(q, ...)` | 0.004 USDC | Google News results (Serper). |
| `google_images(q, ...)` | 0.004 USDC | Google Images results (Serper). |
| `google_shopping(q, ...)` | 0.004 USDC | Google Shopping products (Serper). |
| `render_pdf(html, filename?)` | 0.020 USDC | Public URL of an A4 PDF rendered from self-contained HTML. |
| `flight_booking_links(origin, destination, departureDate, returnDate?)` | Free | Kayak and Kiwi URLs for a new external search. No account or payment required. |
| `renew_upload(id)` | 0.005 USDC | New expiration and renewal metadata. |
| `delete_upload(id)` | Free | `{ "ok": true }` after deleting an active upload. |
| `recent_uploads(limit?, cursor?)` | Free | Recent non-deleted upload records and pagination cursor. |
| `balance()` | Free | Account wallet address and USDC balance. |
| `topup_link()` | Free | Deposit URL for funding the x402 wallet. |
| `setup_link()` | Free | Return a deposit link for the existing account; create an account only when credentials are absent. No reset option. |

## Tool details

### `flight_booking_links(origin, destination, departureDate, returnDate?)`

Generates ordinary Kayak and Kiwi search URLs locally. No Munition account, wallet, payment, provider API key, or affiliate setup is needed to construct them.

```json
{
  "origin": "SFO",
  "destination": "NRT",
  "departureDate": "2027-08-10",
  "returnDate": "2027-08-21"
}
```

Use 3-letter IATA codes and `YYYY-MM-DD` dates; omit `returnDate` for one-way travel. The generated URLs are:

- `https://www.kayak.com/flights/SFO-NRT/2027-08-10/2027-08-21`
- `https://www.kiwi.com/deep?from=SFO&to=NRT&departure=2027-08-10&return=2027-08-21`

Give the links to the traveler as **new external searches**. They must review travelers, cabin, availability, final price, and seller before booking on the external site. Munition does not reserve a seat, collect airfare, or receive a booking confirmation through this tool.

This tool is separate from Duffel-backed `search_flights` and `flight_offer_details`. It accepts no offer ID and does not preserve or guarantee a Duffel itinerary or fare. Do not use it to redirect Duffel results to another seller.

The URLs contain no Munition tracking or affiliate identifiers, and no affiliate commission is attached. Commercial and affiliate use is subject to provider terms; add affiliate identifiers only after acceptance into the relevant program.

### `upload(path, filename?, tags?)`

Uploads a local file up to 10 MB and returns a public URL retained for 7 days.

Input:

```json
{
  "path": "/absolute/path/to/report.pdf",
  "filename": "optional-url-name.pdf",
  "tags": ["agent-output", "report"]
}
```

Rules:

- `path` must be absolute and point to a regular file.
- `filename` is optional URL naming metadata.
- `tags` is optional: up to 20 non-empty strings, max 64 characters each.
- Do not upload secrets, private keys, regulated data, or files that should not be public by URL.

Output includes `id`, `url`, `size`, `mime`, `hash`, and `tags`.

### `search_flights(...)`

Searches live Duffel-backed flight offers. Costs 0.05 USDC.

Input:

```json
{
  "origin": "SFO",
  "destination": "NRT",
  "departureDate": "2026-07-14",
  "returnDate": "2026-07-28",
  "adults": 1,
  "children": 0,
  "infants": 0,
  "travelClass": "ECONOMY",
  "nonStop": false,
  "currency": "USD",
  "maxPrice": 1500,
  "maxResults": 10
}
```

Fields:

- `origin`, `destination`: required 3-letter IATA airport codes.
- `departureDate`: required `YYYY-MM-DD` date.
- `returnDate`: optional `YYYY-MM-DD` date for round trips.
- `adults`, `children`, `infants`: passenger counts; defaults are 1, 0, and 0.
- `travelClass`: `ECONOMY`, `PREMIUM_ECONOMY`, `BUSINESS`, or `FIRST`; default `ECONOMY`.
- `nonStop`: optional direct-flight filter.
- `currency`: optional 3-letter code used with `maxPrice` (`currencyCode` in direct HTTP examples).
- `maxPrice`: optional max total offer price; no currency conversion is applied.
- `maxResults`: optional result cap, 1-50; default 50.

Expected output: a flight offers array (`results`) with itineraries and segments, plus search metadata.

Output:

```json
{
  "results": [
    {
      "id": "off_123",
      "source": "flight_search",
      "totalPrice": "512.30",
      "currency": "USD",
      "airlineCodes": ["AF"],
      "itineraries": [
        {
          "duration": "PT11H25M",
          "numberOfStops": 0,
          "segments": [
            {
              "departure": { "airportCode": "SFO", "at": "2026-07-14T10:00:00" },
              "arrival": { "airportCode": "NRT", "at": "2026-07-15T13:25:00" },
              "carrierCode": "AF",
              "flightNumber": "123",
              "duration": "PT11H25M"
            }
          ]
        }
      ]
    }
  ],
  "meta": { "resultCount": 1, "searchedAt": "2026-05-19T12:00:00Z" }
}
```

### Web research tools

`web_search`, `web_find_similar`, `web_contents`, `web_answer`, `web_scrape`, `web_search_scrape`, `google_search`, `google_news`, `google_images` and `google_shopping` call the account-funded routes `POST /v1/tools/<route>` (for example `/v1/tools/exa-search`). Their input schemas are the same as the direct HTTP routes `/v1/exa/*`, `/v1/firecrawl/*` and `/v1/serper/*` (full contracts in `https://api.munition.io/openapi-full.json`). Invalid input is rejected with 400 before any payment. If the provider fails after settlement, the payment is kept and the error carries `paidCallId`; do not retry blindly.

```json
{ "query": "x402 payment protocol", "numResults": 5, "contents": { "text": true } }
```

### `render_pdf(html, filename?)`

Renders self-contained HTML (inline CSS, `data:` images, no scripts or external resources, up to 1 MiB) into an A4 PDF (up to 20 pages / 10 MiB) and returns `{ id, publicUrl, expiresAt, bytes, pages, sha256, renderMs }`. Costs 0.020 USDC. The URL is public and non-guessable, eligible for deletion after 7 days and not renewable: do not render confidential content. A `render_effect_pending` error means the payment was kept and the PDF was not produced; it carries `paidCallId`. Do not pay again.

```json
{ "html": "<h1>Report</h1><p>Sources: …</p>", "filename": "report.pdf" }
```

### `recent_uploads(limit?, cursor?)`

Lists recent non-deleted uploads for the local account.

Input:

```json
{ "limit": 20, "cursor": 0 }
```

Output includes `items` with `id`, `url`, `size`, `mime`, `hash`, `originalFilename`, `tags`, `uploadedAt`, `expiresAt`, `renewalCount`, and `txHash`, plus `nextCursor` or `null`.

### `renew_upload(id)`

Extends an uploaded file by 7 more days.

```json
{ "id": "file_abc123" }
```

Returns the file id, new `expiresAt`, `renewalCount`, and settlement metadata.

### `delete_upload(id)`

Deletes a previously uploaded file from active uploads.

```json
{ "id": "file_abc123" }
```

Returns `{ "ok": true }`.

### `balance()`

Returns the current Munition account wallet balance:

```json
{
  "accountId": "acct_123",
  "currency": "USDC",
  "network": "base",
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "balanceUsdcAtomic": "1250000",
  "balanceUsdc": "1.25"
}
```

### `topup_link()`

Returns a deposit URL like `https://munition.io/deposit/<wallet>?network=base`. Open it, fund the wallet with USDC on Base, then retry paid calls.

### `setup_link()`

> Release scope: the account-preserving `setup_link()` fix is included in the v0.0.13 release candidate; do not rely on the published `@munition/mcp` v0.0.12 package for this guarantee. This documentation does not confirm that v0.0.13 has been published; verify registry availability and your installed version before relying on the fix.

Returns a deposit link for the existing account without clearing or rewriting its credentials. Only a missing config file or otherwise valid configuration with both credentials absent permits account creation. Corrupt, incomplete, or unreadable configuration fails closed before network requests or writes. There is no reset option; this tool does not recover missing credentials or transfer another account's balance or history. See [Configuration and local state](#configuration-and-local-state).

## Pricing

| Action | Price |
| --- | ---: |
| Upload file | 0.005 USDC |
| Renew upload for 7 days | 0.005 USDC |
| Search flights | 0.05 USDC |
| Web search / similar pages / answer (Exa) | 0.01 USDC |
| Read up to 20 URLs (Exa contents) | 0.002 USDC |
| Scrape one URL (Firecrawl) | 0.015 USDC |
| Search + scrape (Firecrawl) | 0.03 USDC |
| Google search / news / images / shopping | 0.004 USDC |
| HTML to PDF | 0.020 USDC |
| Generate flight booking links | Free |
| Delete upload | Free |
| List recent uploads | Free |
| Check balance | Free |
| Generate deposit/setup link | Free |

If a paid call fails for insufficient funds, call `topup_link()`, open the deposit URL, and add USDC on Base.

## Configuration and local state

Environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `MUNITION_API_URL` | `https://api.munition.io` | Munition API origin. Use `http://localhost:4022` for local server development. |
| `MUNITION_CONFIG` | `~/.munition/config.json` | Local account config path. |

**Do not delete or overwrite the account config to troubleshoot, and do not use `setup_link()` to recover missing credentials.** The active file is `~/.munition/config.json`, or the path set by `MUNITION_CONFIG` in the MCP client environment. It contains `accountId` and the secret `accountToken`; keep it private and never paste it into prompts, logs, issues, or support email.

1. Stop the Munition MCP process before inspecting or changing local state. Preserve the original file and make a private backup with owner-only permissions (directory `0700`, file `0600`) in a persistent, trusted location. Do not overwrite an existing backup.
2. Check that the client runs as the intended OS user, uses the intended `MUNITION_CONFIG` path, can read that file, and uses the correct `MUNITION_API_URL`. If you expected an existing account but its file or both credentials are missing, stop before retrying: a tool call can create a different account. Unreadable, malformed, or incomplete configuration instead fails closed without network requests or writes; preserve it and resolve the configuration error before retrying.
3. If you have a known-good backup for this account, preserve the current file first, then restore that backup to the active path with owner-only permissions while the MCP process is stopped. Restart the client only after verifying the intended configuration.
4. If credentials are missing or you are unsure, stop and contact **hello@munition.io** with a redacted error and, if known, the public wallet address or account id. Never send `accountToken` or the config file. Recovery is not guaranteed; a wallet address or deposit receipt alone does not authenticate account ownership.

`setup_link()` reuses the existing account and returns its deposit link without clearing or rewriting saved credentials. It creates an anonymous account only when both credentials are absent in otherwise valid configuration (including a missing config file). Malformed, incomplete, or unreadable configuration fails closed before network requests or writes. Existing-account API or network errors preserve credentials rather than creating a replacement. There is no reset option and this is not an account-recovery tool. Losing the original credentials can mean losing access to that account, not that its funds were deleted; creating a new account or deposit link does not transfer an old balance or upload history.

## How it works

1. Your MCP client starts `npx -y @munition/mcp` over stdio.
2. `flight_booking_links` constructs external URLs locally, without account creation or an API call.
3. Account-backed tools create or load an anonymous local account and call the Munition API.
4. Paid tools use the account wallet to settle x402 in USDC on Base.
5. Upload uses a presigned file transfer plus paid finalize step; Flight Search calls Duffel and returns normalized offers.
6. The MCP tool returns structured JSON to the agent.

## Common prompts

```text
Use Munition flight_booking_links for SFO to NRT departing 2027-08-10 and returning 2027-08-21. Give me the Kayak and Kiwi search links.
```

```text
Use Munition to upload /Users/me/Desktop/result.json and return the public URL.
```

```text
Use Munition search_flights for SFO to NRT departing 2026-07-14, returning 2026-07-28, 1 adult, economy, max 5 results under 1500 USD.
```

```text
Use Munition to list my recent uploads.
```

```text
Use Munition to renew file_abc123, then check my balance.
```

```text
Use Munition to create a deposit link so I can fund the wallet.
```

## Troubleshooting

### `account token missing`

Stop tool calls and preserve the active config and any backups. Follow [Configuration and local state](#configuration-and-local-state); do not reset the account or create a replacement to diagnose missing credentials.

### Not enough USDC

Call `topup_link()`, open the returned deposit URL, and add USDC on Base.

### `file too large`

The upload limit is 10 MB. Compress the file or upload a smaller artifact.

### `upload path must be absolute`

Use an absolute path, for example `/Users/me/Desktop/report.pdf`.

### MCP client does not show Munition tools

Check that the config uses `npx -y @munition/mcp`, `MUNITION_API_URL=https://api.munition.io`, Node.js 20+, and that the client was restarted after config changes.

## Links

- API: `https://api.munition.io`
- Files: `https://files.munition.io`
- Deposit web app: `https://munition.io`
- Repository: `https://github.com/benjammartin/munitionx402`
