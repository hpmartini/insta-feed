import { expect, test } from 'bun:test';
import { parseFeed } from './rss';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>Alt</title><link>https://x.de/a</link><guid>a</guid><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate><description>&lt;p&gt;Hallo Welt&lt;/p&gt;</description></item>
<item><title>Neu</title><link>https://x.de/b</link><pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate><description>Text</description></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Eintrag</title>
<id>urn:1</id><link rel="alternate" href="https://x.de/e"/><updated>2024-03-01T00:00:00Z</updated><summary>Kurz</summary></entry></feed>`;

test('parses RSS, newest first, strips html in snippet, guid falls back to link', () => {
  const items = parseFeed(RSS);
  expect(items.map((i) => i.title)).toEqual(['Neu', 'Alt']);
  expect(items[0]!.guid).toBe('https://x.de/b');
  expect(items[1]!.snippet).toBe('Hallo Welt');
  expect(items[1]!.isoDate).toBe('2024-01-01T10:00:00.000Z');
});

test('parses Atom', () => {
  const [item] = parseFeed(ATOM);
  expect(item).toMatchObject({ title: 'Eintrag', link: 'https://x.de/e', guid: 'urn:1', snippet: 'Kurz' });
});

test('single item and empty channel', () => {
  expect(parseFeed('<rss><channel><item><title>A</title><link>https://a.de</link></item></channel></rss>')).toHaveLength(1);
  expect(parseFeed('<rss><channel></channel></rss>')).toEqual([]);
});

test('rejects non-feed input', () => {
  expect(() => parseFeed('<html></html>')).toThrow();
});
