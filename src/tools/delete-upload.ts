import { z } from "zod";
import type { ApiClient } from "../client.js";

export const deleteUploadInputSchema = z.object({
  id: z.string().describe("File id to delete"),
});
export type DeleteUploadInput = z.infer<typeof deleteUploadInputSchema>;

export type DeleteUploadOutput = { ok: boolean };

export async function deleteUploadCall(
  api: ApiClient,
  input: DeleteUploadInput,
): Promise<DeleteUploadOutput> {
  const res = await fetch(`${api.apiBaseUrl}/v1/files/${encodeURIComponent(input.id)}`, {
    method: "DELETE",
    headers: api.authHeader(),
  });
  if (!res.ok) throw new Error(`delete failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as DeleteUploadOutput;
}
