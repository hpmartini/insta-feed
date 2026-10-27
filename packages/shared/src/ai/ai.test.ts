import { describe, expect, test } from "bun:test";
import type { FeedItem } from "../types";
import { GeminiAdapter, MockAdapter, getAiAdapter, parseJSON } from "./index";
import type { GeminiClient } from "./gemini";

const item = (id: string, title: string): FeedItem => ({
  id, feedId: 1, feedName: "F", title, link: "", description: `${title} Beschreibung.`, content: "", publishedAt: "2025-10-06T10:00:00.000Z",
});
const items = [item("a", "Bundestag beschließt Klimagesetz"), item("b", "Bundestag beschließt neues Klimagesetz"), item("c", "Wetter morgen sonnig")];

const stub = (impl: () => Promise<{ text?: string }>): GeminiClient => ({ models: { generateContent: impl } });

describe("adapter selection", () => {
  test("no key -> mock; blank key -> mock; key -> gemini (no network call on construction)", () => {
    expect(getAiAdapter({})).toBeInstanceOf(MockAdapter);
    expect(getAiAdapter({ GEMINI_API_KEY: "  " })).toBeInstanceOf(MockAdapter);
    expect(getAiAdapter({ GEMINI_API_KEY: "x" })).toBeInstanceOf(GeminiAdapter);
  });
});

describe("MockAdapter", () => {
  const mock = new MockAdapter();
  test("summary is deterministic: first 3 sentences", async () => {
    const text = "Eins. Zwei. Drei. Vier.";
    expect(await mock.summarize({ title: "T", text })).toBe("Eins. Zwei. Drei.");
    expect(await mock.summarize({ title: "T", text })).toBe(await mock.summarize({ title: "T", text }));
  });
  test("summary falls back to title", async () => {
    expect(await mock.summarize({ title: "Nur Titel", text: "" })).toBe("Nur Titel");
  });
  test("clusters similar headlines", async () => {
    const clusters = await mock.cluster(items);
    expect(clusters.map((c) => c.itemIds)).toEqual([["a", "b"], ["c"]]);
  });
});

describe("GeminiAdapter", () => {
  test("summary comes from the model", async () => {
    const g = new GeminiAdapter("k", stub(async () => ({ text: " Kurzfassung. " })));
    expect(await g.summarize({ title: "T", text: "Eins. Zwei." })).toBe("Kurzfassung.");
  });

  test("model error -> mock fallback for summary and clusters", async () => {
    const g = new GeminiAdapter("k", stub(async () => { throw new Error("boom"); }));
    expect(await g.summarize({ title: "T", text: "Eins. Zwei. Drei. Vier." })).toBe("Eins. Zwei. Drei.");
    expect((await g.cluster(items)).map((c) => c.itemIds)).toEqual([["a", "b"], ["c"]]);
  });

  test("unparsable cluster answer -> mock fallback", async () => {
    const g = new GeminiAdapter("k", stub(async () => ({ text: "Entschuldigung, das kann ich nicht." })));
    expect((await g.cluster(items)).map((c) => c.itemIds)).toEqual([["a", "b"], ["c"]]);
  });

  test("cluster answer is validated: unknown/duplicate numbers dropped, missed items kept", async () => {
    const answer = "```json\n" + JSON.stringify([
      { title: "Klima", summary: "s", items: [1, 2, 99] },
      { title: "Doppelt", summary: "s", items: [1] },
    ]) + "\n```";
    const g = new GeminiAdapter("k", stub(async () => ({ text: answer })));
    const clusters = await g.cluster(items);
    expect(clusters.map((c) => c.itemIds)).toEqual([["a", "b"], ["c"]]);
    expect(clusters[0]!.title).toBe("Klima");
  });
});

test("parseJSON tolerates fences and prose", () => {
  expect(parseJSON<number[]>('Hier:\n```json\n[1,2]\n```')).toEqual([1, 2]);
  expect(parseJSON("kein json")).toBeNull();
  expect(parseJSON("[1,")).toBeNull();
});
