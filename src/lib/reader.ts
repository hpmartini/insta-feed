import { fetchFeed, mergeItems } from "./rss";
import type { Feed, FeedItem } from "./types";

export interface FeedLoadResult {
  items: FeedItem[];
  errors: { feed: Feed; message: string }[];
}

/** Loads all given feeds in parallel; one broken feed must not hide the others. */
export async function loadFeedItems(feeds: Feed[], fetchImpl: typeof fetch = fetch): Promise<FeedLoadResult> {
  const results = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed.url, fetchImpl)));
  const loaded: Parameters<typeof mergeItems>[0] = [];
  const errors: FeedLoadResult["errors"] = [];
  results.forEach((result, i) => {
    const feed = feeds[i];
    if (result.status === "fulfilled") loaded.push({ feedId: feed.id, feedName: feed.name, items: result.value.items });
    else errors.push({ feed, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
  });
  return { items: mergeItems(loaded), errors };
}
