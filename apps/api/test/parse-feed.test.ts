import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseFeed } from "../src/parse-feed";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("RSS: guid, normalized date, snippet; unusable links skipped", async () => {
  const items = await parseFeed(fixture("rss.xml"));
  expect(items).toEqual([
    { guid: "post-1", url: "https://example.com/posts/1", title: "First & best", content: "Hello world", publishedAt: "2026-01-06T10:00:00.000Z" },
    { guid: "https://example.com/posts/2", url: "https://example.com/posts/2", title: "Second", content: "", publishedAt: "2026-01-07T10:00:00.000Z" },
    { guid: "post-3", url: "https://example.com/posts/3", title: "https://example.com/posts/3", content: "" },
  ]);
});

test("Atom: id, alternate link, offset dates; invalid date dropped, feed kept", async () => {
  const items = await parseFeed(fixture("atom.xml"));
  expect(items).toEqual([
    { guid: "urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a", url: "https://example.org/a/1", title: "Atom one", content: "Short summary", publishedAt: "2026-01-05T07:00:00.000Z" },
    { guid: "urn:uuid:2", url: "https://example.org/a/2", title: "Atom bad date", content: "Body text" },
    { guid: "https://example.org/a/3", url: "https://example.org/a/3", title: "Atom no id", content: "" },
  ]);
});

test("deterministic; empty feed gives []; broken XML rejects", async () => {
  const xml = fixture("rss.xml");
  expect(await parseFeed(xml)).toEqual(await parseFeed(xml));
  expect(await parseFeed('<rss version="2.0"><channel><title>t</title></channel></rss>')).toEqual([]);
  await expect(parseFeed("<rss><channel><item>")).rejects.toThrow();
  await expect(parseFeed("not xml")).rejects.toThrow();
});
