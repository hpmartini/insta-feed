import { describe, expect, test } from "bun:test";
import { parseFeed } from "./rss";

const feed = { id: 1, name: "Test" };

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item><title>Erste &amp; zweite Meldung</title><link>https://a.test/1</link><guid>g1</guid>
<pubDate>Mon, 06 Oct 2025 10:00:00 GMT</pubDate><description>Kurz &lt;b&gt;fett&lt;/b&gt; Text. Zweiter Satz.</description></item>
<item><title><![CDATA[CDATA <Titel>]]></title><link>https://a.test/2</link>
<description><![CDATA[<p>Absatz <a href="x">Link</a></p>]]></description><content:encoded><![CDATA[<p>Voller Inhalt</p>]]></content:encoded><pubDate>kaputt</pubDate></item>
<item><link>https://a.test/3</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title type="html">Atom Titel</title><id>urn:1</id>
<link rel="self" href="https://a.test/self"/><link rel="alternate" href="https://a.test/a?x=1&amp;y=2"/>
<updated>2025-10-06T10:00:00Z</updated><summary>Atom Summary</summary></entry></feed>`;

describe("parseFeed", () => {
  test("RSS 2.0: entities, tags stripped, dates, title-less items dropped", () => {
    const items = parseFeed(RSS, feed);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "Erste & zweite Meldung",
      link: "https://a.test/1",
      description: "Kurz fett Text. Zweiter Satz.",
      publishedAt: "2025-10-06T10:00:00.000Z",
      feedId: 1,
      feedName: "Test",
    });
    expect(items[0]!.content).toContain("<b>fett</b>");
  });

  test("CDATA, content:encoded as content, invalid date does not throw", () => {
    const item = parseFeed(RSS, feed)[1]!;
    expect(item.title).toBe("CDATA");
    expect(item.description).toBe("Absatz Link");
    expect(item.content).toBe("<p>Voller Inhalt</p>");
    expect(item.publishedAt).toBe(new Date(0).toISOString());
  });

  test("Atom: alternate link, summary, updated", () => {
    const [item] = parseFeed(ATOM, feed);
    expect(item).toMatchObject({ title: "Atom Titel", link: "https://a.test/a?x=1&y=2", description: "Atom Summary", publishedAt: "2025-10-06T10:00:00.000Z" });
  });

  test("ids are stable and differ per item", () => {
    const a = parseFeed(RSS, feed);
    const b = parseFeed(RSS, feed);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(a[0]!.id).not.toBe(a[1]!.id);
  });

  test("non-feed input -> []", () => {
    expect(parseFeed("<html><body>404</body></html>", feed)).toEqual([]);
    expect(parseFeed("", feed)).toEqual([]);
    expect(parseFeed("<rss><channel><item><title>kaputt", feed)).toEqual([]);
  });
});

test("hostile input stays linear", () => {
  const t = performance.now();
  parseFeed(`<rss>${"<item ".repeat(100_000)}`, feed);
  parseFeed(`<rss><item><title>${"<script ".repeat(100_000)}</title></item></rss>`, feed);
  parseFeed(`<rss><item><title>${"<".repeat(200_000)}</title></item></rss>`, feed);
  expect(performance.now() - t).toBeLessThan(2000);
});
