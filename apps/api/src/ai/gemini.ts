import { Type } from "@google/genai";
import { AiProviderError, SummaryPayloadSchema, type AiAdapter } from "./adapter";

/** The slice of GoogleGenAI we use, so tests can stub it. */
export interface GeminiClient {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }): Promise<{ text?: string }>;
  };
}

export const GEMINI_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20_000;

const responseSchema = {
  type: Type.OBJECT,
  properties: { text: { type: Type.STRING, description: "Summary of the article in 2-3 sentences, same language as the article." } },
  required: ["text"],
};

export class GeminiAdapter implements AiAdapter {
  readonly provider = "gemini" as const;
  readonly model = GEMINI_MODEL;

  constructor(private readonly client: GeminiClient, private readonly timeoutMs = TIMEOUT_MS) {}

  async summarize({ title, content }: { title: string; content: string }) {
    let raw: string | undefined;
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: `Summarize this article.\n\nTitle: ${title}\n\n${content}`,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });
      raw = res.text;
    } catch {
      // Never forward the SDK message: it may echo request details.
      throw new AiProviderError("gemini request failed");
    }
    if (!raw) throw new AiProviderError("gemini returned no text");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AiProviderError("gemini returned invalid JSON");
    }
    const parsed = SummaryPayloadSchema.safeParse(json);
    if (!parsed.success) throw new AiProviderError("gemini response violated the schema");
    return parsed.data;
  }
}
