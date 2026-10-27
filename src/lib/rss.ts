import { XMLParser } from "fast-xml-parser";
import type { FeedItem, ParsedFeed } from "@/lib/types";

// Entities are decoded by decode() below, so the parser must leave them alone (avoids double decoding).
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  processEntities: false,
  isArray: (name) => name === "item" || name === "entry",
});

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** Undecoded text of a node that may be a plain string or an object with #text (attributes present). */
function raw(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return raw((v as Record<string, unknown>)["#text"]);
  return String(v);
}

const text = (v: unknown) => decode(raw(v)).trim();

function toSnippet(html: string): string {
  // Tags are stripped before and after decoding: escaped HTML (&lt;p&gt;) only becomes tags after decode.
  const plain = decode(html.replace(/<[^>]*>/g, " ")).replace(/<[^>]*>/g, " ");
  return plain.replace(/\s+/g, " ").trim().slice(0, 300);
}

function toIso(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function atomLink(v: unknown): string {
  const links = (Array.isArray(v) ? v : [v]).filter(Boolean) as Array<Record<string, string> | string>;
  const pick = links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate")) ?? links[0];
  if (!pick) return "";
  return typeof pick === "string" ? pick.trim() : (pick["@_href"] ?? "").trim();
}

function item(title: string, link: string, guid: string, html: string, date: unknown): FeedItem {
  return { guid: guid || link || title, title, link, snippet: toSnippet(html), publishedAt: toIso(date) };
}

export function parseFeed(xml: string): ParsedFeed {
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new Error("Kein gültiger RSS- oder Atom-Feed");
  }

  const channel = doc?.rss?.channel;
  if (channel !== undefined) {
    return {
      title: text(channel.title),
      link: text(channel.link),
      items: (channel.item ?? []).map((i: Record<string, unknown>) =>
        item(text(i.title), text(i.link), text(i.guid), raw(i.description) || raw(i["content:encoded"]), i.pubDate),
      ),
    };
  }

  const feed = doc?.feed;
  if (feed !== undefined) {
    return {
      title: text(feed.title),
      link: atomLink(feed.link),
      items: (feed.entry ?? []).map((e: Record<string, unknown>) =>
        item(text(e.title), atomLink(e.link), text(e.id), raw(e.summary) || raw(e.content), e.updated ?? e.published),
      ),
    };
  }

  throw new Error("Kein gültiger RSS- oder Atom-Feed");
}

/** Trust boundary: only http(s) URLs may be fetched server-side. */
export function assertHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Ungültige URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Nur http(s)-URLs erlaubt: ${raw}`);
  }
  if (PRIVATE_HOST.test(url.hostname)) throw new Error(`Interne Adressen sind nicht erlaubt: ${raw}`);
  return url;
}

// shortcut: checks host literals only, not DNS results or redirects; resolve and pin IPs if exposed publicly.
const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1?\]|\[f[cd][0-9a-f:]*\]|\[fe80:[0-9a-f:]*\])$/i;

export async function fetchFeed(url: string, fetchImpl: typeof fetch = fetch): Promise<ParsedFeed> {
  const res = await fetchImpl(assertHttpUrl(url), {
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "InstaFeed/2.0" },
  });
  if (!res.ok) throw new Error(`Feed-Abruf fehlgeschlagen: HTTP ${res.status}`);
  return parseFeed(await res.text());
}

export function mergeItems(feeds: Array<{ feedId: number; feedName: string; items: FeedItem[] }>): FeedItem[] {
  const all = feeds.flatMap((f) => f.items.map((i) => ({ ...i, feedId: f.feedId, feedName: f.feedName })));
  const time = (i: FeedItem) => (i.publishedAt ? Date.parse(i.publishedAt) : -Infinity);
  all.sort((a, b) => time(b) - time(a));
  const seen = new Set<string>();
  return all.filter((i) => {
    const key = i.link || i.guid;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
