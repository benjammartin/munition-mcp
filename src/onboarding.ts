import { saveConfig, type MunitionConfig } from "./config.js";
import { z } from "zod";

const bootstrapResponseSchema = z.object({
  accountId: z.string().min(1),
  accountToken: z.string().min(1),
});

export type OnboardingState = { ready: true; config: MunitionConfig };

async function bootstrapAccount(config: MunitionConfig): Promise<MunitionConfig> {
  const res = await fetch(`${config.apiBaseUrl}/v1/accounts/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`accounts/bootstrap failed: ${res.status} ${await res.text()}`);
  const body = bootstrapResponseSchema.parse(await res.json());
  const next: MunitionConfig = {
    ...config,
    accountId: body.accountId,
    accountToken: body.accountToken,
  };
  await saveConfig(next);
  return next;
}

export async function bootstrapOnboarding(config: MunitionConfig): Promise<OnboardingState> {
  if (config.accountId && config.accountToken) return { ready: true, config };
  return { ready: true, config: await bootstrapAccount(config) };
}
