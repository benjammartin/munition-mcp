import { z } from "zod";
import type { ApiClient } from "../client.js";

export const recentUploadsInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.number().int().nonnegative().optional(),
});
export type RecentUploadsInput = z.infer<typeof recentUploadsInputSchema>;

export type RecentUploadsItem = {
  id: string;
  url: string;
  size: number;
  mime: string;
  hash: string;
  originalFilename: string | null;
  tags: string[];
  uploadedAt: string;
  expiresAt: string;
  renewalCount: number;
  txHash: string | null;
};

export type RecentUploadsOutput = {
  items: RecentUploadsItem[];
  nextCursor: number | null;
};

export async function recentUploadsCall(
  api: ApiClient,
  input: RecentUploadsInput,
): Promise<RecentUploadsOutput> {
  const params = new URLSearchParams();
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  if (input.cursor !== undefined) params.set("cursor", String(input.cursor));
  const qs = params.toString();
  const url = `${api.apiBaseUrl}/v1/files${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: api.authHeader() });
  if (!res.ok) throw new Error(`recent_uploads failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as RecentUploadsOutput;
}
