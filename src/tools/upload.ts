import { readFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { z } from "zod";
import type { ApiClient } from "../client.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadTagsSchema = z
  .array(z.string().min(1).max(64))
  .max(20)
  .optional()
  .describe("Optional stable upload tags for categorization. Tags are serialized and returned as an array of strings.");

export const uploadInputSchema = z.object({
  path: z.string().describe("Absolute path to the local file"),
  filename: z.string().optional().describe("Optional name for the URL slug"),
  tags: uploadTagsSchema,
});
export type UploadInput = z.infer<typeof uploadInputSchema>;

export type UploadOutput = { id: string; url: string; size: number; mime: string; hash: string; tags: string[] };

export async function computeFileMetadata(path: string): Promise<{
  size: number;
  mime: string;
  sha256: string;
  sha256Base64: string;
}> {
  if (!isAbsolute(path)) throw new Error("upload path must be absolute");
  const info = await stat(path);
  if (!info.isFile()) throw new Error("upload path must point to a regular file");
  if (info.size > MAX_UPLOAD_BYTES) {
    throw new Error(`file too large: max ${MAX_UPLOAD_BYTES} bytes`);
  }
  const buf = await readFile(path);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const sha256Base64 = createHash("sha256").update(buf).digest("base64");
  // Iter 3 mime guess; replaced by 'file-type' lib in Iter 6.
  const ext = path.toLowerCase().split(".").pop();
  const mime =
    ext === "png" ? "image/png" :
    ext === "jpg" ? "image/jpeg" :
    ext === "jpeg" ? "image/jpeg" :
    ext === "json" ? "application/json" :
    ext === "txt" ? "text/plain" :
    ext === "pdf" ? "application/pdf" :
    "application/octet-stream";
  return { size: buf.byteLength, mime, sha256, sha256Base64 };
}

export async function uploadCall(api: ApiClient, input: UploadInput): Promise<UploadOutput> {
  const meta = await computeFileMetadata(input.path);
  const idempotencyKey = randomUUID();

  // Step 1 — init (free, account token auth).
  const initRes = await fetch(`${api.apiBaseUrl}/v1/tools/upload/init`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...api.authHeader(),
    },
    body: JSON.stringify({
      filename: input.filename,
      mime: meta.mime,
      size: meta.size,
      sha256: meta.sha256,
      sha256Base64: meta.sha256Base64,
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    }),
  });
  if (!initRes.ok) throw new Error(`init failed ${initRes.status}: ${await initRes.text()}`);
  const initBody = (await initRes.json()) as {
    uploadSessionId: string;
    presignedUrl: string;
    expiresAt: string;
  };

  // Step 2 — S3 PUT
  const bytes = await readFile(input.path);
  const putRes = await fetch(initBody.presignedUrl, {
    method: "PUT",
    headers: {
      "content-type": meta.mime,
      "content-length": String(meta.size),
      "x-amz-checksum-sha256": meta.sha256Base64,
      "x-amz-meta-sha256": meta.sha256,
    },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`S3 PUT failed ${putRes.status}: ${await putRes.text()}`);

  // Step 3 — finalize (paid, signs and settles x402 from the account wallet).
  const finalRes = await fetch(`${api.apiBaseUrl}/v1/tools/upload/finalize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...api.authHeader(),
    },
    body: JSON.stringify({ uploadSessionId: initBody.uploadSessionId }),
  });
  if (!finalRes.ok) throw new Error(`finalize failed ${finalRes.status}: ${await finalRes.text()}`);
  return (await finalRes.json()) as UploadOutput;
}
