import { XMLParser } from 'fast-xml-parser';
import type { FeedItem } from '@instafeed/shared';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
/** Text of a node that may be a string, number or {#text}. */
const text = (v: unknown): string =>
  v == null ? '' : typeof v === 'object' ? text((v as Record<string, unknown>)['#text']) : String(v).trim();
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function atomLink(links: unknown): string {
  const all = arr(links as Record<string, string>[]);
  const l = all.find((x) => !x['@_rel'] || x['@_rel'] === 'alternate') ?? all[0];
  return l?.['@_href'] ?? '';
}

function isoDate(v: string): string {
  const t = Date.parse(v);
  return Number.isNaN(t) ? new Date(0).toISOString() : new Date(t).toISOString();
}

/** Parses RSS 2.0, RDF and Atom into FeedItems, newest first. Throws on non-feed input. */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  let items: FeedItem[];
  if (doc.rss || doc['rdf:RDF']) {
    const raw = arr(doc.rss ? doc.rss.channel?.item : doc['rdf:RDF'].item);
    items = raw.map((i: Record<string, unknown>) => {
      const content = text(i['content:encoded']) || text(i.description);
      const link = text(i.link);
      return {
        guid: text(i.guid) || link,
        title: text(i.title),
        link,
        content,
        snippet: stripHtml(text(i.description) || content).slice(0, 300),
        isoDate: isoDate(text(i.pubDate) || text(i['dc:date'])),
      };
    });
  } else if (doc.feed) {
    items = arr(doc.feed.entry).map((e: Record<string, unknown>) => {
      const content = text(e.content) || text(e.summary);
      const link = atomLink(e.link);
      return {
        guid: text(e.id) || link,
        title: text(e.title),
        link,
        content,
        snippet: stripHtml(text(e.summary) || content).slice(0, 300),
        isoDate: isoDate(text(e.published) || text(e.updated)),
      };
    });
  } else {
    throw new Error('Kein RSS- oder Atom-Feed');
  }
  return items.filter((i) => i.title && i.link).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
}
