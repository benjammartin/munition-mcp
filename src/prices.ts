export type PricesResponse = {
  version: string;
  validUntil: string;
  tools: Record<
    string,
    {
      amountUsd: number;
      amountUsdcAtomic: string;
      currency: string;
      [key: string]: unknown;
    }
  >;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cached: { value: PricesResponse; fetchedAt: number } | null = null;

export async function getPrices(
  apiBaseUrl: string,
  opts?: { force?: boolean },
): Promise<PricesResponse> {
  if (!opts?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}/v1/tools/prices`);
  } catch (err) {
    if (cached) return cached.value; // soft fallback to stale cache
    throw err;
  }
  if (!res.ok) {
    if (cached) return cached.value; // soft fallback to stale cache
    throw new Error(`prices fetch failed: ${res.status} ${await res.text()}`);
  }
  const value = (await res.json()) as PricesResponse;
  cached = { value, fetchedAt: Date.now() };
  return value;
}

export function clearPriceCache(): void {
  cached = null;
}
