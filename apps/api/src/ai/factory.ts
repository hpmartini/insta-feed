import { GoogleGenAI } from "@google/genai";
import type { AiAdapter } from "./adapter";
import { GeminiAdapter } from "./gemini";
import { MockAdapter } from "./mock";

/** AI_PROVIDER=mock wins even with a key; otherwise a key selects Gemini, else mock. Read env only in the entry point. */
export function createAiAdapter(cfg: { provider?: string; geminiApiKey?: string }): AiAdapter {
  const key = cfg.geminiApiKey?.trim();
  if (cfg.provider?.trim().toLowerCase() === "mock" || !key) return new MockAdapter();
  return new GeminiAdapter(new GoogleGenAI({ apiKey: key }));
}
