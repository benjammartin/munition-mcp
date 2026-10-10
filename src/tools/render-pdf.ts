import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ApiClient } from "../client.js";

export const renderPdfInputSchema = z.object({
  html: z.string().min(1),
  filename: z.string().min(1).max(180).optional(),
}).strict();
export type RenderPdfInput = z.infer<typeof renderPdfInputSchema>;

export type RenderPdfOutput = {
  id: string;
  publicUrl: string;
  expiresAt: string;
  bytes: number;
  pages: number;
  sha256: string;
  renderMs: number;
};

export const renderPdfToolDefinition = {
  name: "render_pdf",
  description: "Render self-contained HTML (inline CSS, data: images, no scripts or external resources, up to 1 MiB) into an A4 PDF (up to 20 pages / 10 MiB) and return its public URL. Costs 0.020 USDC per call via x402 from the account wallet. The URL is public and non-guessable, eligible for deletion after 7 days, and not renewable: do not render confidential content. If the response is render_effect_pending, the payment was kept and the error carries paidCallId: do not pay again.",
  // Copied verbatim from the server's renderPdfJsonSchema (kept identical by a server contract test).
  inputSchema: {
    "type": "object",
    "properties": {
      "html": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1048576,
        "description": "Self-contained HTML document (UTF-8, up to 1 MiB) with inline CSS. No JavaScript, iframes, forms, <link>, external or relative resources: scripting is disabled and document requests are intercepted/aborted in an offline browser context, not process-wide OS egress isolation. The Chromium sandbox is disabled; process isolation is a deployment concern. Embed images and fonts as data: URIs (png, jpeg, gif, webp, svg, woff/woff2/ttf/otf). Output is A4, up to 20 pages / 10 MiB on successful return, with a 10-second application-level render watchdog budget. Launch, shutdown and cleanup can extend elapsed call time; this is not a hard process-lifetime bound. Page and PDF-byte limits are checked after PDF allocation and do not bound peak memory or CPU."
      },
      "filename": {
        "type": "string",
        "minLength": 1,
        "maxLength": 180,
        "description": "Optional filename used for a readable public URL slug, for example invoice-2026-09.pdf. Consecutive dots (..) anywhere are invalid."
      }
    },
    "required": [
      "html"
    ],
    "additionalProperties": false
  },
} as const;

export async function renderPdfCall(api: ApiClient, input: RenderPdfInput): Promise<RenderPdfOutput> {
  const res = await fetch(`${api.apiBaseUrl}/v1/tools/render-pdf`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      ...api.authHeader(),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`render_pdf failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as RenderPdfOutput;
}
