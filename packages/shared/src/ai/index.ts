import type { AiAdapter } from "./adapter";
import { GeminiAdapter } from "./gemini";
import { MockAdapter } from "./mock";

export type { AiAdapter, SummaryInput } from "./adapter";
export { GeminiAdapter, parseJSON } from "./gemini";
export { MockAdapter } from "./mock";

/** The key only ever comes from the environment and is never logged. */
export function getAiAdapter(env: Record<string, string | undefined> = process.env): AiAdapter {
  const key = env.GEMINI_API_KEY?.trim();
  return key ? new GeminiAdapter(key) : new MockAdapter();
}
