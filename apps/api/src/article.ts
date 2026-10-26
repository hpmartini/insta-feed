import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { ArticleDetail } from '@instafeed/shared';
import { HttpError } from './http';

/** Extracts the readable text of an HTML page (replaces the old browser-side Readability call). */
export function extractArticle(html: string, url: string): ArticleDetail {
  const { document } = parseHTML(html);
  const parsed = new Readability(document as unknown as Document).parse();
  if (!parsed) throw new HttpError(422, 'Artikel nicht lesbar');
  return {
    siteName: parsed.siteName ?? new URL(url).hostname,
    title: parsed.title ?? '',
    excerpt: parsed.excerpt ?? '',
    content: (parsed.textContent ?? '').trim().replace(/\s+/g, ' '),
    url,
  };
}
