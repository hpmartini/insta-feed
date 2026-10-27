import { describe, expect, test } from "bun:test";
import { assertHttpUrl, fetchFeed, mergeItems, parseFeed } from "./rss";
import type { FeedItem } from "@/lib/types";

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Tom &amp; Jerry News</title>
    <link>https://example.com</link>
    <item>
      <title>First &amp; foremost</title>
      <link>https://example.com/1</link>
      <guid isPermaLink="false">id-1</guid>
      <description><![CDATA[<p>Hello <b>world</b> &amp; &#228;</p>]]></description>
      <pubDate>Tue, 01 Oct 2024 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second</title>
      <link>https://example.com/2</link>
      <description>&lt;p&gt;Escaped   &quot;html&quot; &#39;x&#39;&lt;/p&gt;</description>
      <pubDate>not a date</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Atom Blog</title>
  <link rel="self" href="https://blog.test/feed.xml"/>
  <link rel="alternate" href="https://blog.test/"/>
  <entry>
    <title type="html">Entry one</title>
    <link rel="self" href="https://blog.test/self/1"/>
    <link rel="alternate" href="https://blog.test/1"/>
    <id>urn:uuid:1</id>
    <summary>Short &lt;em&gt;summary&lt;/em&gt;</summary>
    <updated>2024-10-02T08:00:00Z</updated>
  </entry>
  <entry>
    <title>Entry two</title>
    <link href="https://blog.test/2"/>
    <id>urn:uuid:2</id>
    <content type="html">Body text</content>
    <published>2024-10-01T08:00:00Z</published>
  </entry>
</feed>`;

describe("parseFeed", () => {
  test("RSS 2.0 with CDATA and entities", () => {
    const feed = parseFeed(RSS);
    expect(feed.title).toBe("Tom & Jerry News");
    expect(feed.link).toBe("https://example.com");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toEqual({
      guid: "id-1",
      title: "First & foremost",
      link: "https://example.com/1",
      snippet: "Hello world & ä",
      publishedAt: "2024-10-01T10:00:00.000Z",
    });
    expect(feed.items[1].guid).toBe("https://example.com/2");
    expect(feed.items[1].snippet).toBe(`Escaped "html" 'x'`);
    expect(feed.items[1].publishedAt).toBeNull();
  });

  test("Atom with alternate links and object titles", () => {
    const feed = parseFeed(ATOM);
    expect(feed.title).toBe("Atom Blog");
    expect(feed.link).toBe("https://blog.test/");
    expect(feed.items.map((i) => i.link)).toEqual(["https://blog.test/1", "https://blog.test/2"]);
    expect(feed.items[0]).toMatchObject({ guid: "urn:uuid:1", title: "Entry one", snippet: "Short summary" });
    expect(feed.items[1]).toMatchObject({ snippet: "Body text", publishedAt: "2024-10-01T08:00:00.000Z" });
  });

  test("single RSS item becomes an array; guid falls back to title", () => {
    const feed = parseFeed(`<rss><channel><title>T</title><item><title>Only</title></item></channel></rss>`);
    expect(feed.items).toEqual([{ guid: "Only", title: "Only", link: "", snippet: "", publishedAt: null }]);
  });

  test("snippet is capped at 300 chars", () => {
    const long = "a ".repeat(400);
    const feed = parseFeed(`<rss><channel><item><description>${long}</description></item></channel></rss>`);
    expect(feed.items[0].snippet.length).toBe(300);
  });

  test("throws on non-feed input", () => {
    expect(() => parseFeed("<html><body>nope</body></html>")).toThrow("Kein gültiger RSS- oder Atom-Feed");
    expect(() => parseFeed("not xml at all")).toThrow("Kein gültiger RSS- oder Atom-Feed");
  });
});

describe("assertHttpUrl", () => {
  test("accepts http(s)", () => {
    expect(assertHttpUrl("https://a.test/x").hostname).toBe("a.test");
    expect(assertHttpUrl("http://a.test").protocol).toBe("http:");
  });
  test("rejects other schemes and garbage", () => {
    expect(() => assertHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => assertHttpUrl("javascript:alert(1)")).toThrow();
    expect(() => assertHttpUrl("not a url")).toThrow();
  });
  test("rejects internal hosts", () => {
    for (const u of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://192.168.1.1", "http://172.20.0.1", "http://169.254.169.254", "http://[::1]/"]) {
      expect(() => assertHttpUrl(u)).toThrow("Interne");
    }
    expect(assertHttpUrl("http://172.32.0.1").hostname).toBe("172.32.0.1");
  });
});

describe("fetchFeed", () => {
  test("fetches with user-agent and parses", async () => {
    let seen: { url: string; ua: string | null; signal: unknown } | undefined;
    const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(input), ua: new Headers(init?.headers).get("user-agent"), signal: init?.signal };
      return new Response(RSS);
    }) as typeof fetch;
    const feed = await fetchFeed("https://example.com/feed", stub);
    expect(feed.items).toHaveLength(2);
    expect(seen?.url).toBe("https://example.com/feed");
    expect(seen?.ua).toBe("InstaFeed/2.0");
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
  });

  test("throws on HTTP error and bad scheme", async () => {
    const stub = (async () => new Response("x", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchFeed("https://example.com/feed", stub)).rejects.toThrow("404");
    await expect(fetchFeed("file:///etc/passwd", stub)).rejects.toThrow();
  });
});

describe("mergeItems", () => {
  const it = (link: string, publishedAt: string | null): FeedItem => ({ guid: link, title: link, link, snippet: "", publishedAt });

  test("tags, sorts newest first with null dates last, dedupes by link", () => {
    const merged = mergeItems([
      { feedId: 1, feedName: "A", items: [it("x", "2024-01-01T00:00:00Z"), it("nodate", null)] },
      { feedId: 2, feedName: "B", items: [it("y", "2024-03-01T00:00:00Z"), it("x", "2024-02-01T00:00:00Z")] },
    ]);
    expect(merged.map((i) => i.link)).toEqual(["y", "x", "nodate"]);
    expect(merged[1]).toMatchObject({ feedId: 2, feedName: "B", publishedAt: "2024-02-01T00:00:00Z" });
    expect(merged[2]).toMatchObject({ feedId: 1, feedName: "A" });
  });
});
