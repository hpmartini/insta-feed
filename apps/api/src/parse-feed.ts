import Parser from "rss-parser";

export interface ArticleDraft {
  guid: string;
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
}

type AtomEntry = { published?: string[]; updated?: string[] };

const isoOrUndefined = (raw: string | undefined): string | undefined => {
  const d = raw ? new Date(raw.trim()) : undefined;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
};

const httpUrl = (raw: string | undefined): string | undefined => {
  try {
    const u = new URL(raw?.trim() ?? "");
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};

function newParser(): Parser {
  const parser = new Parser();
  // rss-parser throws RangeError on an invalid Atom date and would drop the whole feed; drop only the date.
  const internal = parser as unknown as { parseItemAtom(entry: AtomEntry): unknown };
  const parseItemAtom = internal.parseItemAtom.bind(parser);
  internal.parseItemAtom = (entry) => {
    for (const k of ["published", "updated"] as const) if (!isoOrUndefined(entry[k]?.[0])) delete entry[k];
    return parseItemAtom(entry);
  };
  return parser;
}

/** Pure: no network, db, clock or randomness. Rejects on malformed XML. Items without a usable http(s) link are skipped. */
export async function parseFeed(xml: string): Promise<ArticleDraft[]> {
  const feed = await newParser().parseString(xml);
  const drafts: ArticleDraft[] = [];
  for (const item of feed.items) {
    const url = httpUrl(item.link);
    if (!url) continue;
    const raw = item as typeof item & { id?: string; summary?: string };
    const publishedAt = isoOrUndefined(item.isoDate ?? item.pubDate);
    drafts.push({
      guid: item.guid?.trim() || raw.id?.trim() || url,
      url,
      title: item.title?.trim() || url,
      // rss-parser derives contentSnippet only from Atom <content>; Atom <summary> is kept raw, so strip tags here.
      content: (item.contentSnippet || raw.summary?.replace(/<[^>]*>/g, ""))?.trim() ?? "",
      ...(publishedAt && { publishedAt }),
    });
  }
  return drafts;
}
