import { z } from "zod";
import type { ApiClient } from "../client.js";

export const balanceInputSchema = z.object({}).strict();
export type BalanceInput = z.infer<typeof balanceInputSchema>;

export type BalanceOutput = {
  accountId: string;
  currency: "USDC";
  network: string;
  walletAddress: string;
  balanceUsdcAtomic: string;
  balanceUsdc: string;
};

export async function balanceCall(api: ApiClient): Promise<BalanceOutput> {
  const res = await fetch(`${api.apiBaseUrl}/v1/account/balance`, {
    headers: api.authHeader(),
  });
  if (!res.ok) throw new Error(`balance failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as BalanceOutput;
}
