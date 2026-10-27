import { createHash } from "node:crypto";
import { mergeSources, type Source } from "@insta-feed/shared";

/** Bump on any change to normalization, threshold, window or grouping. */
export const CLUSTER_VERSION = "jaccard-v1";
export const DEFAULT_THRESHOLD = 0.75;
export const WINDOW_MS = 48 * 3600_000;

export interface ClusterInput {
  id: string;
  title: string;
  url: string;
  feedName: string;
  publishedAt?: string;
}
export interface Cluster {
  id: string;
  title: string;
  articleIds: string[];
  sources: Source[];
}

/** NFKC + lowercase; every non-letter/digit run is a separator, digits are kept. */
export function wordSet(title: string): Set<string> {
  return new Set(title.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

/** Two empty sets are NOT similar (BakeNews scored them 1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Groups articles published within [now − 48 h, now]; undated, unparsable or future ones are excluded.
 * An article joins the first group where it is similar (≥ threshold) to EVERY member, so chains cannot bridge.
 * Input is copied; output is independent of input order.
 */
export function clusterArticles(items: readonly ClusterInput[], now: Date, threshold = DEFAULT_THRESHOLD): Cluster[] {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new RangeError("threshold must be in (0, 1]");
  const t = now.getTime();
  const dated = items.flatMap((a) => {
    const ts = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
    return ts >= t - WINDOW_MS && ts <= t ? [{ a, ts, words: wordSet(a.title) }] : [];
  });
  dated.sort((x, y) => y.ts - x.ts || (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0));

  const groups: (typeof dated)[] = [];
  for (const d of dated) {
    const g = groups.find((m) => m.every((o) => jaccard(d.words, o.words) >= threshold));
    if (g) g.push(d);
    else groups.push([d]);
  }
  return groups.map((g) => {
    const ids = g.map((m) => m.a.id);
    return {
      id: createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex").slice(0, 16),
      title: g[0]!.a.title,
      articleIds: ids,
      sources: mergeSources(g.map((m) => ({ name: m.a.feedName, url: m.a.url, origin: "feed" as const }))),
    };
  });
}
