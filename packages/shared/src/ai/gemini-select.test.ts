import { expect, mock, test } from "bun:test";
import type { FeedItem } from "../types";

// Stub the SDK at its import boundary so the real path getAiAdapter -> GeminiAdapter -> GoogleGenAI runs offline.
const seen: string[] = [];
const calls: Array<{ model: string; contents: string; config?: { systemInstruction?: string } }> = [];
let answer = "";
mock.module("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(opts: { apiKey: string }) {
      seen.push(opts.apiKey);
    }
    models = {
      generateContent: async (args: (typeof calls)[number]) => {
        calls.push(args);
        return { text: answer };
      },
    };
  },
}));

const { GeminiAdapter, MockAdapter, getAiAdapter } = await import("./index");

const item = (id: string, title: string): FeedItem => ({ id, feedId: 1, feedName: "F", title, link: "", description: "d", content: "", publishedAt: "2025-10-06T10:00:00.000Z" });

test("GEMINI_API_KEY selects Gemini, builds the SDK client with the trimmed key and routes summarize + cluster through it", async () => {
  const ai = getAiAdapter({ GEMINI_API_KEY: " test-key " });
  expect(ai).toBeInstanceOf(GeminiAdapter);
  expect(seen).toEqual(["test-key"]);

  answer = "  Modell-Zusammenfassung  ";
  expect(await ai.summarize({ title: "Titel-X", text: "Text" })).toBe("Modell-Zusammenfassung");
  expect(calls[0]!.model).toBe("gemini-2.5-flash");
  expect(calls[0]!.config?.systemInstruction).toBeTruthy();
  expect(calls[0]!.contents).toContain("Titel-X");

  answer = '```json\n[{"title":"Modell-Story","summary":"s","items":[1,2]}]\n```';
  const clusters = await ai.cluster([item("a", "Alpha"), item("b", "Beta")]);
  expect(clusters).toEqual([{ title: "Modell-Story", summary: "s", itemIds: ["a", "b"] }]);
  expect(calls).toHaveLength(2);
});

test("no key -> mock, the SDK is not constructed", () => {
  expect(getAiAdapter({})).toBeInstanceOf(MockAdapter);
  expect(seen).toHaveLength(1);
});
