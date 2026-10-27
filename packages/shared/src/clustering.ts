import type { Cluster, FeedItem } from "./types";
import { firstSentences } from "./text";

// Jaccard story clustering, ported from BakeNews (services/clustering.ts).
// Default threshold is lower than BakeNews' 0.75: headlines of different outlets for the same story
// share few words. Override with CLUSTERING_THRESHOLD.
export const DEFAULT_THRESHOLD = 0.5;

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
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Longest headline wins, ties go to the newest; summary is the lead of the newest item with text. */
export function mergeCluster(items: FeedItem[]): Pick<Cluster, "title" | "summary"> {
  const byTime = (a: FeedItem, b: FeedItem) => b.publishedAt.localeCompare(a.publishedAt);
  const newest = [...items].sort(byTime);
  const title = [...items].sort((a, b) => b.title.length - a.title.length || byTime(a, b))[0]?.title ?? "";
  const summary = firstSentences(newest.find((i) => i.description)?.description ?? "", 2);
  return { title, summary };
}

/** Greedy: each item joins the first cluster it is similar enough to, else opens a new one. */
export function clusterItems(items: FeedItem[], threshold = thresholdFromEnv()): Cluster[] {
  const clusters: { words: Set<string>; items: FeedItem[] }[] = [];
  for (const item of items) {
    const words = normalizeTitle(item.title);
    const hit = clusters.find((c) => jaccardSimilarity(words, c.words) >= threshold);
    if (hit) {
      hit.items.push(item);
      for (const w of words) hit.words.add(w);
    } else {
      clusters.push({ words, items: [item] });
    }
  }
  return clusters.map((c) => ({ ...mergeCluster(c.items), itemIds: c.items.map((i) => i.id) }));
}

function thresholdFromEnv(): number {
  const v = parseFloat(process.env.CLUSTERING_THRESHOLD ?? "");
  return v > 0 && v <= 1 ? v : DEFAULT_THRESHOLD;
}
