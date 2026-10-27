import { createHash } from "node:crypto";
import type { Feed, FeedItem } from "./types";
import { asciiLower, decodeEntities, stripHtml } from "./text";

/** Text of the first <tag>…</tag>, CDATA unwrapped (not entity-decoded). Ported from BakeNews. */
export function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([\\s\\S]*?))</${tag}>`, "i");
  const m = xml.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

/** All <tag …>…</tag> blocks via indexOf: linear, unlike a lazy regex on unclosed tags in hostile input. */
function blocks(xml: string, tag: string): string[] {
  const lower = asciiLower(xml);
  const out: string[] = [];
  const close = `</${tag}>`;
  for (let from = 0; ; ) {
    const start = lower.indexOf(`<${tag}`, from);
    if (start < 0) return out;
    const next = lower[start + tag.length + 1];
    if (next !== ">" && next !== " " && next !== "\n" && next !== "\t" && next !== "\r") { from = start + 1; continue; }
    const end = lower.indexOf(close, start);
    if (end < 0) return out;
    out.push(xml.slice(start, end + close.length));
    from = end + close.length;
  }
}

function atomLink(entry: string): string {
  const links = [...entry.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const pick = links.find((l) => /rel\s*=\s*["']alternate["']/i.test(l)) ?? links.find((l) => !/rel\s*=/i.test(l)) ?? links[0];
  return decodeEntities(pick?.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] ?? "");
}

function isoDate(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

/**
 * RSS 2.0 and Atom -> FeedItem[]. Anything that is not an XML feed (HTML error page, junk) -> [].
 * Regex based on purpose: no dependency, good enough for feeds; items without a title are dropped.
 */
export function parseFeed(xml: string, feed: Pick<Feed, "id" | "name">): FeedItem[] {
  if (typeof xml !== "string" || !/^\s*(<\?xml|<rss|<feed|<rdf:RDF)/i.test(xml)) return [];

  const rss = blocks(xml, "item");
  const atom = rss.length ? [] : blocks(xml, "entry");

  const items = [...rss, ...atom].map((x): FeedItem => {
    const isAtom = !rss.length;
    const link = isAtom ? atomLink(x) : decodeEntities(extractTag(x, "link"));
    const html = decodeIfEscaped(
      (isAtom ? extractTag(x, "content") || extractTag(x, "summary") : extractTag(x, "content:encoded") || extractTag(x, "description")),
    );
    const description = stripHtml(
      decodeIfEscaped(isAtom ? extractTag(x, "summary") || extractTag(x, "content") : extractTag(x, "description") || extractTag(x, "content:encoded")),
    );
    const id = extractTag(x, isAtom ? "id" : "guid") || link || extractTag(x, "title");
    return {
      id: `${feed.id}-${createHash("sha1").update(id).digest("hex").slice(0, 16)}`,
      feedId: feed.id,
      feedName: feed.name,
      title: stripHtml(extractTag(x, "title")),
      link,
      description,
      content: html,
      publishedAt: isoDate(extractTag(x, isAtom ? "updated" : "pubDate") || extractTag(x, "published") || extractTag(x, "dc:date")),
    };
  });
  return items.filter((i) => i.title);
}

/** Feeds either wrap HTML in CDATA (already HTML) or escape it (&lt;p&gt;); normalise to HTML. */
function decodeIfEscaped(s: string): string {
  return /&lt;[a-z]/i.test(s) && !/<[a-z]/i.test(s) ? decodeEntities(s) : s;
}
