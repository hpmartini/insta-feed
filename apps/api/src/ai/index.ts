import { clusterIndexes, type AiProvider, type ArticleListItem, type StoryCluster } from '@instafeed/shared';

export interface SummaryInput {
  title: string;
  text: string;
}

/** Swappable AI backend: Gemini when GEMINI_API_KEY is set, deterministic mock otherwise. */
export interface AiAdapter {
  provider: AiProvider;
  summarize(input: SummaryInput): Promise<string>;
  /** Groups articles into stories; every article must appear in exactly one cluster. */
  cluster(articles: ArticleListItem[]): Promise<StoryCluster[]>;
}

const sentences = (text: string) => text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [];

export function mockAdapter(): AiAdapter {
  return {
    provider: 'mock',
    async summarize({ title, text }) {
      const s = sentences(text).map((x) => x.trim()).filter(Boolean).slice(0, 3).join(' ');
      return s || title;
    },
    async cluster(articles) {
      return clusterIndexes(articles.map((a) => a.title)).map((idx) => {
        const members = idx.map((i) => articles[i]!);
        const lead = members[0]!;
        return { title: lead.title, summary: lead.snippet, articles: members };
      });
    },
  };
}

const MODEL = 'gemini-2.5-flash';

export function geminiAdapter(apiKey: string, fetchImpl: typeof fetch = fetch): AiAdapter {
  const mock = mockAdapter();

  async function generate(prompt: string, asJson = false): Promise<string> {
    const res = await fetchImpl(`${process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: 'Antworte auf Deutsch, neutral und präzise.' }] },
        ...(asJson ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
    if (!out) throw new Error('Gemini: leere Antwort');
    return out;
  }

  return {
    provider: 'gemini',
    summarize: ({ title, text }) =>
      generate(`Fasse den Artikel in 2-3 Sätzen zusammen.\n\nTitel: ${title}\n\n${text.slice(0, 12000)}`),
    async cluster(articles) {
      const list = articles.map((a, i) => `${i}: ${a.title}`).join('\n');
      try {
        const raw = await generate(
          `Gruppiere diese Schlagzeilen nach derselben Story. Antworte als JSON: ` +
            `[{"title": string, "summary": string (1 Satz), "ids": number[]}]. Jede Nummer genau einmal.\n\n${list}`,
          true,
        );
        const groups = JSON.parse(raw) as { title: string; summary: string; ids: number[] }[];
        const seen = new Set<number>();
        const clusters: StoryCluster[] = [];
        for (const g of groups) {
          const ids = g.ids.filter((i) => articles[i] && !seen.has(i));
          ids.forEach((i) => seen.add(i));
          if (ids.length) clusters.push({ title: g.title, summary: g.summary, articles: ids.map((i) => articles[i]!) });
        }
        // Articles Gemini dropped become their own stories rather than vanishing.
        articles.forEach((a, i) => {
          if (!seen.has(i)) clusters.push({ title: a.title, summary: a.snippet, articles: [a] });
        });
        return clusters;
      } catch {
        return mock.cluster(articles);
      }
    },
  };
}

export function createAi(env: Record<string, string | undefined> = process.env): AiAdapter {
  return env.GEMINI_API_KEY ? geminiAdapter(env.GEMINI_API_KEY) : mockAdapter();
}
