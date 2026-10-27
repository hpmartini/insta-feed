import { GoogleGenAI } from "@google/genai";
import type { AiAdapter, FeedItem, Story } from "@/lib/types";
import { sortStories, toStory } from "./cluster";
import { mockAi } from "./mock";

const MAX_CONTENT = 12000;

/** Parses an LLM JSON answer, tolerating markdown code fences. */
export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as T;
  } catch {
    return null;
  }
}

export function createGeminiAi(opts: {
  apiKey: string;
  model?: string;
  generate?: (prompt: string) => Promise<string>;
}): AiAdapter {
  const model = opts.model ?? "gemini-2.5-flash";
  const generate =
    opts.generate ??
    (async (prompt: string) => {
      const ai = new GoogleGenAI({ apiKey: opts.apiKey });
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      return res.text ?? "";
    });

  // Any failure falls back to the mock so callers always get an answer.
  async function withFallback<T>(what: string, run: () => Promise<T | null>, fallback: () => Promise<T>) {
    try {
      const result = await run();
      if (result !== null) return result;
      console.warn(`gemini ${what}: unparseable answer, using mock`);
    } catch (err) {
      console.warn(`gemini ${what} failed, using mock:`, err);
    }
    return fallback();
  }

  return {
    name: "gemini",
    summarize(input) {
      return withFallback(
        "summarize",
        async () => {
          const prompt = `Fasse den folgenden Artikel sachlich und neutral auf Deutsch zusammen.
Antworte ausschließlich mit JSON: {"summary": "3-5 Sätze"}

Titel: ${input.title}

${input.content.slice(0, MAX_CONTENT)}`;
          const summary = parseJson<{ summary?: unknown }>(await generate(prompt))?.summary;
          return typeof summary === "string" && summary.trim() ? summary.trim() : null;
        },
        () => mockAi.summarize(input),
      );
    },
    clusterStories(items) {
      if (items.length === 0) return Promise.resolve([]);
      return withFallback(
        "clusterStories",
        async () => {
          const list = items.map((i, idx) => `${idx}. ${i.title} (${i.feedName ?? "?"})`).join("\n");
          const prompt = `Gruppiere die folgenden Nachrichten nach derselben Geschichte, auch über Feeds hinweg.
Antworte ausschließlich mit JSON: {"stories":[{"title":"...","summary":"2-3 Sätze auf Deutsch","items":[Indizes]}]}

${list}`;
          const parsed = parseJson<{ stories?: unknown }>(await generate(prompt));
          return parsed && Array.isArray(parsed.stories) ? mapStories(items, parsed.stories) : null;
        },
        () => mockAi.clusterStories(items),
      );
    },
  };
}

/** Maps index-based model clusters back to items; invalid or reused indices are dropped, leftovers become single stories. */
function mapStories(items: FeedItem[], raw: unknown[]): Story[] {
  const used = new Set<number>();
  const stories: Story[] = [];
  for (const s of raw as { title?: unknown; summary?: unknown; items?: unknown }[]) {
    const indices = (Array.isArray(s?.items) ? s.items : []).filter(
      (i): i is number => Number.isInteger(i) && i >= 0 && i < items.length && !used.has(i),
    );
    const unique = [...new Set(indices)];
    if (unique.length === 0) continue;
    unique.forEach((i) => used.add(i));
    stories.push(
      toStory(
        unique.map((i) => items[i]),
        typeof s.title === "string" ? s.title : undefined,
        typeof s.summary === "string" ? s.summary : undefined,
      ),
    );
  }
  items.forEach((item, i) => {
    if (!used.has(i)) stories.push(toStory([item]));
  });
  return sortStories(stories);
}
