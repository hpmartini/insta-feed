import { describe, expect, spyOn, test } from "bun:test";
import type { FeedItem } from "@/lib/types";
import { clusterByTitle, createGeminiAi, getAi, mockAi } from "./index";

const item = (guid: string, title: string, feedName: string, publishedAt = "2026-10-27T10:00:00Z"): FeedItem => ({
  guid,
  title,
  link: `https://example.com/${guid}`,
  snippet: `Snippet ${guid}.`,
  publishedAt,
  feedName,
});

const items = [
  item("a", "Bundestag beschließt neues Heizungsgesetz", "Tagesschau"),
  item("b", "Fußball: Bayern gewinnt gegen Dortmund", "Kicker"),
  item("c", "Heizungsgesetz: Bundestag beschließt neues Gesetz", "Spiegel", "2026-10-27T11:00:00Z"),
];

describe("mockAi", () => {
  test("summarize returns first 3 sentences, deterministic", async () => {
    const input = { title: "T", content: "Eins. Zwei!  Drei? Vier. Fünf." };
    const out = await mockAi.summarize(input);
    expect(out).toBe("Eins. Zwei! Drei?");
    expect(await mockAi.summarize(input)).toBe(out);
  });

  test("summarize falls back to title for empty content", async () => {
    expect(await mockAi.summarize({ title: "Titel", content: "  " })).toBe("Titel");
  });
});

describe("clusterByTitle", () => {
  test("groups near-duplicate titles across feeds, keeps unrelated apart", () => {
    const stories = clusterByTitle(items, 0.5);
    expect(stories).toHaveLength(2);
    expect(stories[0].items.map((i) => i.guid)).toEqual(["c", "a"]);
    expect(stories[0].title).toBe("Heizungsgesetz: Bundestag beschließt neues Gesetz");
    expect(stories[0].summary).toBe("Snippet c. Snippet a.");
    expect(stories[1].items.map((i) => i.guid)).toEqual(["b"]);
    expect(clusterByTitle(items, 0.5)[0].id).toBe(stories[0].id);
  });
});

describe("getAi", () => {
  test("mock without key, gemini with key", () => {
    expect(getAi({}).name).toBe("mock");
    expect(getAi({ GEMINI_API_KEY: "" }).name).toBe("mock");
    expect(getAi({ GEMINI_API_KEY: "k" }).name).toBe("gemini");
  });
});

describe("gemini adapter", () => {
  test("summarize parses fenced JSON and truncates content", async () => {
    let prompt = "";
    const ai = createGeminiAi({
      apiKey: "k",
      generate: async (p) => {
        prompt = p;
        return '```json\n{"summary": "Kurz gefasst."}\n```';
      },
    });
    expect(await ai.summarize({ title: "T", content: "x".repeat(20000) })).toBe("Kurz gefasst.");
    expect(prompt.length).toBeLessThan(13000);
  });

  test("clusterStories maps indices, drops invalid, keeps unassigned", async () => {
    const ai = createGeminiAi({
      apiKey: "k",
      generate: async () =>
        JSON.stringify({ stories: [{ title: "Heizung", summary: "Zusammenfassung.", items: [0, 2, 99, -1] }] }),
    });
    const stories = await ai.clusterStories(items);
    expect(stories).toHaveLength(2);
    expect(stories[0]).toMatchObject({ title: "Heizung", summary: "Zusammenfassung." });
    expect(stories[0].items.map((i) => i.guid).sort()).toEqual(["a", "c"]);
    expect(stories[1].items.map((i) => i.guid)).toEqual(["b"]);
  });

  test("falls back to mock when generate throws or returns garbage", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const input = { title: "T", content: "Eins. Zwei. Drei. Vier." };
    for (const generate of [async () => { throw new Error("boom"); }, async () => "not json"]) {
      const ai = createGeminiAi({ apiKey: "k", generate });
      expect(await ai.summarize(input)).toBe(await mockAi.summarize(input));
      expect(await ai.clusterStories(items)).toEqual(clusterByTitle(items));
    }
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });
});

test("gemini adapter does a real SDK round trip with the key (local Gemini-compatible server)", async () => {
  const seen: { path: string; key: string | null }[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      seen.push({ path: new URL(req.url).pathname, key: req.headers.get("x-goog-api-key") });
      const text = JSON.stringify({ summary: "Zusammenfassung aus Gemini." });
      return Response.json({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] });
    },
  });
  try {
    const ai = getAi({ GEMINI_API_KEY: "k-123", GEMINI_BASE_URL: server.url.origin });
    expect(await ai.summarize({ title: "T", content: "Inhalt." })).toBe("Zusammenfassung aus Gemini.");
    expect(seen).toEqual([{ path: "/v1beta/models/gemini-2.5-flash:generateContent", key: "k-123" }]);
  } finally {
    server.stop(true);
  }
});
