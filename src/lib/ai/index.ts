import type { AiAdapter } from "@/lib/types";
import { createGeminiAi } from "./gemini";
import { mockAi } from "./mock";

export function getAi(env: Record<string, string | undefined> = process.env): AiAdapter {
  const apiKey = env.GEMINI_API_KEY?.trim();
  return apiKey ? createGeminiAi({ apiKey, model: env.GEMINI_MODEL || "gemini-2.5-flash", baseUrl: env.GEMINI_BASE_URL || undefined }) : mockAi;
}

export { mockAi } from "./mock";
export { createGeminiAi } from "./gemini";
export { clusterByTitle } from "./cluster";
