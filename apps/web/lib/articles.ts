import { parseFeed, type Feed, type FeedItem } from "@instafeed/shared";
import { listFeeds, getFeed } from "./feeds";
import { safeFetchText, type SafeFetchOptions } from "./proxy";

const PER_FEED = 30;

export interface FeedError {
  feedId: number;
  feedName: string;
  error: string;
}

export async function fetchFeedItems(feed: Feed, opts?: SafeFetchOptions): Promise<FeedItem[]> {
  const { text } = await safeFetchText(feed.url, { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", ...opts });
  return parseFeed(text, feed).slice(0, PER_FEED);
}

/**
 * Newest-first items of all subscribed feeds, or of one feed when feedId is given.
 * One broken feed never fails the rest: it shows up in `errors`.
 */
export async function loadArticles(userId: number, feedId?: number, opts?: SafeFetchOptions) {
  const feeds = feedId ? [getFeed(userId, feedId)] : listFeeds(userId).filter((f) => f.subscribed);
  const results = await Promise.allSettled(feeds.map((f) => fetchFeedItems(f, opts)));
  const items: FeedItem[] = [];
  const errors: FeedError[] = [];
  results.forEach((r, i) => {
    const feed = feeds[i]!;
    if (r.status === "fulfilled") items.push(...r.value);
    else errors.push({ feedId: feed.id, feedName: feed.name, error: r.reason instanceof Error ? r.reason.message : "Fehler" });
  });
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items, errors, feeds };
}
