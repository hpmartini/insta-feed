import type { FeedItem, Story } from "@/lib/types";

// German + English stop words
const STOP_WORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
  "und", "oder", "aber", "doch", "nicht", "auch", "nur", "noch", "schon",
  "ist", "sind", "war", "hat", "wird", "kann", "soll", "muss", "will",
  "für", "mit", "von", "auf", "aus", "bei", "nach", "vor", "über", "unter",
  "sich", "wie", "als", "wenn", "dass", "weil", "damit", "um", "zu",
  "im", "am", "zum", "zur", "vom", "beim", "ins", "ans",
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "has", "have",
  "for", "with", "from", "by", "to", "in", "on", "at", "of", "be",
]);

const SUMMARY_MAX = 400;

export function normalizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-zäöüß\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

const time = (item: FeedItem) => (item.publishedAt ? Date.parse(item.publishedAt) || 0 : 0);

/** Builds a Story from grouped items: longest title, unique snippets newest first. */
export function toStory(items: FeedItem[], title?: string, summary?: string): Story {
  const newestFirst = [...items].sort((a, b) => time(b) - time(a));
  const snippets = [...new Set(newestFirst.map((i) => i.snippet.trim()).filter(Boolean))].join(" ");
  return {
    id: `story-${hashString(items[0]?.guid ?? "")}`,
    title: title || items.reduce((best, i) => (i.title.length > best.length ? i.title : best), ""),
    summary:
      summary ||
      (snippets.length > SUMMARY_MAX ? `${snippets.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : snippets),
    items: newestFirst,
  };
}

/** Biggest stories first, ties broken by newest item. */
export function sortStories(stories: Story[]): Story[] {
  const newest = (s: Story) => Math.max(0, ...s.items.map(time));
  return stories.sort((a, b) => b.items.length - a.items.length || newest(b) - newest(a));
}

/**
 * Greedy Jaccard clustering: each item joins the first matching cluster or starts a new one.
 * Default 0.5 instead of BakeNews' 0.75: different outlets word headlines more differently.
 */
export function clusterByTitle(
  items: FeedItem[],
  threshold = Number(process.env.CLUSTERING_THRESHOLD ?? 0.5),
): Story[] {
  const clusters: { words: Set<string>; items: FeedItem[] }[] = [];
  for (const item of items) {
    const words = normalizeTitle(item.title);
    const match = clusters.find((c) => jaccardSimilarity(words, c.words) >= threshold);
    if (match) {
      match.items.push(item);
      for (const w of words) match.words.add(w);
    } else {
      clusters.push({ words, items: [item] });
    }
  }
  return sortStories(clusters.map((c) => toStory(c.items)));
}
