import { createHash } from "node:crypto";
import { GeminiAdapter, getAiAdapter, stripHtml, type AiAdapter, type Cluster, type FeedItem } from "@instafeed/shared";
import { loadArticles } from "./articles";
import { getDb } from "./db";
import { HttpError } from "./errors";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

/** Cached per user and adapter kind, so Gemini is asked once per article and switching the key does not serve stale mock text. */
export async function summarize(userId: number, input: { url: string; title: string; content: string }, ai: AiAdapter = getAiAdapter()): Promise<string> {
  const text = stripHtml(input.content).slice(0, 20_000);
  if (!input.title.trim() && !text) throw new HttpError(400, "title oder content erforderlich");
  const key = `${ai instanceof GeminiAdapter ? "gemini" : "mock"}:${sha1(input.url || input.title)}`;
  const db = getDb();
  const hit = db.query("SELECT summary FROM summaries WHERE user_id = ? AND item_key = ?").get(userId, key) as { summary: string } | null;
  if (hit) return hit.summary;
  const summary = await ai.summarize({ title: input.title, text });
  db.query("INSERT OR REPLACE INTO summaries (user_id, item_key, summary) VALUES (?, ?, ?)").run(userId, key, summary);
  return summary;
}

export interface Story {
  title: string;
  summary: string;
  items: FeedItem[];
}

// Last result per user, keyed by the set of items: same articles -> no second model call.
const lastStories = new Map<number, { key: string; stories: Story[] }>();

export async function loadStories(userId: number, ai: AiAdapter = getAiAdapter()) {
  const { items, errors } = await loadArticles(userId);
  const key = (ai instanceof GeminiAdapter ? "g" : "m") + sha1(items.map((i) => i.id).sort().join());
  let cached = lastStories.get(userId);
  if (cached?.key !== key) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const clusters: Cluster[] = await ai.cluster(items);
    const stories = clusters
      .map((c) => ({ title: c.title, summary: c.summary, items: c.itemIds.flatMap((id) => byId.get(id) ?? []) }))
      .filter((s) => s.items.length)
      .sort((a, b) => b.items.length - a.items.length);
    cached = { key, stories };
    lastStories.set(userId, cached);
  }
  return { stories: cached.stories, errors };
}
