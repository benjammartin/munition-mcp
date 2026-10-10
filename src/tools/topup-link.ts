import { z } from "zod";
import type { ApiClient } from "../client.js";

export const topupLinkInputSchema = z.object({}).strict();
export type TopupLinkInput = z.infer<typeof topupLinkInputSchema>;

export type TopupLinkOutput = { url: string };

export async function topupLinkCall(api: ApiClient): Promise<TopupLinkOutput> {
  const res = await fetch(`${api.apiBaseUrl}/v1/account/topup-link`, {
    method: "POST",
    headers: api.authHeader(),
  });
  if (!res.ok) throw new Error(`topup-link failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as TopupLinkOutput;
}
