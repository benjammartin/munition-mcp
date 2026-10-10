import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { ApiClient } from "../client.js";

export const renewUploadInputSchema = z.object({
  id: z.string().describe("File id to renew"),
});
export type RenewUploadInput = z.infer<typeof renewUploadInputSchema>;

export type RenewUploadOutput = {
  id: string;
  expiresAt: string;
  renewalCount: number;
  txHash: string | null;
};

export async function renewUploadCall(
  api: ApiClient,
  input: RenewUploadInput,
): Promise<RenewUploadOutput> {
  const idempotencyKey = randomUUID();
  const res = await fetch(`${api.apiBaseUrl}/v1/files/${encodeURIComponent(input.id)}/renew`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...api.authHeader(),
    },
  });
  if (!res.ok) throw new Error(`renew failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as RenewUploadOutput;
}
