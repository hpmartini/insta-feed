import { expect, test } from "bun:test";
import { loadFeedItems } from "./reader";
import type { Feed } from "./types";

const rss = (title: string, date: string) =>
  `<rss version="2.0"><channel><title>x</title><link>https://x.test</link><item><title>${title}</title><link>https://x.test/${encodeURIComponent(title)}</link><pubDate>${date}</pubDate></item></channel></rss>`;

const feed = (id: number, url: string): Feed => ({
  id, userId: "u", name: `Feed ${id}`, url, icon: "📰", subscribed: true, createdAt: "",
});

test("merges feeds newest first and isolates failing feeds", async () => {
  const fakeFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("broken")) return new Response("nope", { status: 500 });
    const body = url.includes("a.test") ? rss("Alt", "Mon, 01 Jan 2024 10:00:00 GMT") : rss("Neu", "Tue, 02 Jan 2024 10:00:00 GMT");
    return new Response(body);
  }) as typeof fetch;

  const { items, errors } = await loadFeedItems(
    [feed(1, "https://a.test/rss"), feed(2, "https://b.test/rss"), feed(3, "https://broken.test/rss")],
    { fetch: fakeFetch, resolve: async () => ["93.184.216.34"] },
  );
  expect(items.map((i) => [i.title, i.feedName])).toEqual([["Neu", "Feed 2"], ["Alt", "Feed 1"]]);
  expect(errors).toHaveLength(1);
  expect(errors[0].feed.id).toBe(3);
});
