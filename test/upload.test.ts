import { beforeEach, describe, it, expect, vi } from "vitest";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeFileMetadata, uploadCall, uploadInputSchema } from "../src/tools/upload";
import { recentUploadsCall } from "../src/tools/recent-uploads";
import type { ApiClient } from "../src/client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("computeFileMetadata", () => {
  it("returns size, mime guess, sha256 hex and base64", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mun-"));
    const file = join(dir, "x.txt");
    await writeFile(file, "hello\n", "utf8");
    const m = await computeFileMetadata(file);
    expect(m.size).toBe(6);
    expect(m.mime).toBe("text/plain");
    expect(m.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(m.sha256Base64).toHaveLength(44);
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mun-"));
    const file = join(dir, "x.weird");
    await writeFile(file, "data");
    const m = await computeFileMetadata(file);
    expect(m.mime).toBe("application/octet-stream");
  });

  it("recognizes the common image and json extensions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mun-"));
    const png = join(dir, "x.png");
    const jpg = join(dir, "x.jpg");
    const json = join(dir, "x.json");
    await writeFile(png, "x");
    await writeFile(jpg, "x");
    await writeFile(json, "{}");
    expect((await computeFileMetadata(png)).mime).toBe("image/png");
    expect((await computeFileMetadata(jpg)).mime).toBe("image/jpeg");
    expect((await computeFileMetadata(json)).mime).toBe("application/json");
  });

  it("rejects relative paths before reading from disk", async () => {
    await expect(computeFileMetadata("relative.txt")).rejects.toThrow(/absolute/);
  });

  it("rejects directories", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mun-"));
    await expect(computeFileMetadata(dir)).rejects.toThrow(/regular file/);
  });

  it("rejects files above the upload size limit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mun-"));
    const file = join(dir, "too-large.bin");
    await writeFile(file, Buffer.alloc(10 * 1024 * 1024 + 1));
    await expect(computeFileMetadata(file)).rejects.toThrow(/file too large/);
  });
});

describe("uploadInputSchema", () => {
  it("accepts optional upload tags and keeps omitted tags backward-compatible", () => {
    expect(uploadInputSchema.parse({ path: "/tmp/report.pdf", tags: ["agent-output", "report"] })).toMatchObject({
      path: "/tmp/report.pdf",
      tags: ["agent-output", "report"],
    });
    expect(uploadInputSchema.parse({ path: "/tmp/report.pdf" })).toMatchObject({ path: "/tmp/report.pdf" });
  });

  it("rejects malformed tag input before calling the server", () => {
    expect(() => uploadInputSchema.parse({ path: "/tmp/report.pdf", tags: ["ok", 42] })).toThrow();
    expect(() => uploadInputSchema.parse({ path: "/tmp/report.pdf", tags: [""] })).toThrow();
    expect(() => uploadInputSchema.parse({ path: "/tmp/report.pdf", tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) })).toThrow();
  });
});

describe("uploadCall", () => {
  it("passes upload tags to the init endpoint and returns tags from finalize output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mun-"));
    const file = join(dir, "tagged.txt");
    await writeFile(file, "tagged file\n", "utf8");
    const api: ApiClient = {
      apiBaseUrl: "https://api.test",
      authHeader: () => ({ authorization: "Bearer test-token" }),
    };

    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        uploadSessionId: "ups_123",
        presignedUrl: "https://s3.test/presigned-put",
        expiresAt: "2026-05-18T00:00:00.000Z",
      }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({
        id: "upl_123",
        url: "https://files.test/upl_123-tagged.txt",
        size: 12,
        mime: "text/plain",
        hash: "abc123",
        tags: ["agent-output", "report"],
      }));

    const result = await uploadCall(api, {
      path: file,
      filename: "tagged.txt",
      tags: ["agent-output", "report"],
    });

    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toMatchObject({
      filename: "tagged.txt",
      tags: ["agent-output", "report"],
    });
    expect(result.tags).toEqual(["agent-output", "report"]);
  });
});

describe("recentUploadsCall", () => {
  it("returns tag arrays from the server list output", async () => {
    const api: ApiClient = {
      apiBaseUrl: "https://api.test",
      authHeader: () => ({ authorization: "Bearer test-token" }),
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [
        {
          id: "upl_tagged",
          url: "https://files.test/upl_tagged.txt",
          size: 12,
          mime: "text/plain",
          hash: "abc123",
          originalFilename: "tagged.txt",
          tags: ["agent-output", "report"],
          uploadedAt: "2026-05-18T00:00:00.000Z",
          expiresAt: "2026-05-25T00:00:00.000Z",
          renewalCount: 0,
          txHash: "0xtx",
        },
        {
          id: "upl_legacy",
          url: "https://files.test/upl_legacy.txt",
          size: 8,
          mime: "text/plain",
          hash: "def456",
          originalFilename: "legacy.txt",
          tags: [],
          uploadedAt: "2026-05-17T00:00:00.000Z",
          expiresAt: "2026-05-24T00:00:00.000Z",
          renewalCount: 0,
          txHash: null,
        },
      ],
      nextCursor: null,
    }));

    const result = await recentUploadsCall(api, { limit: 2 });

    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/v1/files?limit=2");
    expect(result.items.map(item => ({ id: item.id, tags: item.tags }))).toEqual([
      { id: "upl_tagged", tags: ["agent-output", "report"] },
      { id: "upl_legacy", tags: [] },
    ]);
  });
});
