import { GoogleGenAI } from "@google/genai";
import type { Cluster, FeedItem } from "../types";
import { clusterItems } from "../clustering";
import type { AiAdapter, SummaryInput } from "./adapter";
import { MockAdapter } from "./mock";

const MODEL = "gemini-2.5-flash";
const SYSTEM = "Antworte immer auf Deutsch. Sei neutral, sachlich und präzise.";
const MAX_CLUSTER_ITEMS = 80;
const MAX_TEXT_CHARS = 12_000;

/** Minimal slice of the SDK client, so tests can stub it. */
export interface GeminiClient {
  models: {
    generateContent(args: { model: string; contents: string; config?: { systemInstruction?: string } }): Promise<{ text?: string }>;
  };
}

/** Models like to wrap JSON in ```json fences or prose; take the outermost array. */
export function parseJSON<T>(raw: string): T | null {
  const s = raw.replace(/```(?:json)?/gi, "");
  const from = s.indexOf("[");
  const to = s.lastIndexOf("]");
  if (from < 0 || to < from) return null;
  try {
    return JSON.parse(s.slice(from, to + 1)) as T;
  } catch {
    return null;
  }
}

export class GeminiAdapter implements AiAdapter {
  private client: GeminiClient;
  private fallback = new MockAdapter();

  constructor(apiKey: string, client?: GeminiClient) {
    this.client = client ?? new GoogleGenAI({ apiKey });
  }

  private async ask(prompt: string): Promise<string> {
    const res = await this.client.models.generateContent({ model: MODEL, contents: prompt, config: { systemInstruction: SYSTEM } });
    return res.text ?? "";
  }

  async summarize(input: SummaryInput): Promise<string> {
    try {
      const out = (
        await this.ask(
          `Fasse den folgenden Artikel in 2-4 Sätzen zusammen. Antworte nur mit dem Fließtext, ohne Markdown.\n\nTitel: ${input.title}\n\n${input.text.slice(0, MAX_TEXT_CHARS)}`,
        )
      ).trim();
      if (out) return out;
    } catch (e) {
      console.error("[AI] Gemini summarize failed, using mock:", e instanceof Error ? e.message : "unknown error");
    }
    return this.fallback.summarize(input);
  }

  async cluster(items: FeedItem[]): Promise<Cluster[]> {
    const batch = items.slice(0, MAX_CLUSTER_ITEMS);
    try {
      // Short numeric ids in the prompt: cheaper, and the answer is checked against them.
      const list = batch.map((it, i) => `${i + 1}. [${it.feedName}] ${it.title}`).join("\n");
      const raw = parseJSON<Array<{ title?: unknown; summary?: unknown; items?: unknown }>>(
        await this.ask(
          `Gruppiere die folgenden Schlagzeilen nach derselben Nachrichtenstory (mehrere Quellen, gleiches Ereignis).\n` +
            `Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Markdown. Struktur pro Eintrag: ` +
            `{"title": "prägnante Schlagzeile", "summary": "1-2 Sätze", "items": [Nummern der Schlagzeilen]}.\n` +
            `Jede Nummer genau einmal verwenden; Einzelmeldungen als eigener Eintrag.\n\n${list}`,
        ),
      );
      if (!raw?.length) throw new Error("unparsable response");

      const used = new Set<number>();
      const clusters: Cluster[] = [];
      for (const r of raw) {
        const nums = Array.isArray(r.items) ? r.items.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= batch.length && !used.has(n)) : [];
        if (!nums.length || typeof r.title !== "string") continue;
        nums.forEach((n) => used.add(n));
        clusters.push({
          title: r.title,
          summary: typeof r.summary === "string" ? r.summary : "",
          itemIds: nums.map((n) => batch[n - 1]!.id),
        });
      }
      // Items the model dropped or mangled stay visible as clusters of their own.
      const rest = batch.filter((_, i) => !used.has(i + 1));
      return [...clusters, ...rest.map((it) => ({ title: it.title, summary: it.description, itemIds: [it.id] }))];
    } catch (e) {
      console.error("[AI] Gemini cluster failed, using mock:", e instanceof Error ? e.message : "unknown error");
      return clusterItems(items);
    }
  }
}
