import { z } from "zod";
import { loadConfig } from "../config.js";
import { bootstrapOnboarding } from "../onboarding.js";
import { buildClient } from "../client.js";
import { topupLinkCall } from "./topup-link.js";

export const setupLinkInputSchema = z.object({}).strict();
export type SetupLinkInput = z.infer<typeof setupLinkInputSchema>;

export type SetupLinkOutput = { link: string };

export async function setupLinkCall(): Promise<SetupLinkOutput> {
  const config = await loadConfig();
  const state = await bootstrapOnboarding(config);
  const api = buildClient(state.config);
  const result = await topupLinkCall(api);
  return { link: result.url };
}
