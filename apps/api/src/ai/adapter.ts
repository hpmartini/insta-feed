import { z } from "zod";

/** Bump when the prompt or payload shape changes: it is part of every cache key. */
export const PROMPT_VERSION = "summary-v1";

/** All a provider may say; identity, sources and provider/model are added server-side. */
export const SummaryPayloadSchema = z.object({ text: z.string().trim().min(1) });
export type SummaryPayload = z.infer<typeof SummaryPayloadSchema>;

export interface AiAdapter {
  readonly provider: "mock" | "gemini" | "claude";
  readonly model: string;
  summarize(input: { title: string; content: string }): Promise<SummaryPayload>;
}

/** Transport or response failure of a real provider; the message is safe to show (no secrets). */
export class AiProviderError extends Error {}
