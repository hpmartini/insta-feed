import { expect, test } from 'bun:test';
import type { ArticleListItem } from '@instafeed/shared';
import { createAi, geminiAdapter, mockAdapter } from './ai';

const art = (title: string, snippet = ''): ArticleListItem => ({
  guid: title, title, link: `https://x.de/${title}`, content: '', snippet, isoDate: '2024-01-01T00:00:00.000Z',
  feedId: 'f', feedName: 'F',
});
const arts = [
  art('Bundestag beschließt neues Klimagesetz'),
  art('Klimagesetz im Bundestag beschlossen'),
  art('Fußball: Bayern gewinnt Pokalfinale'),
];

test('mock summary: first three sentences, deterministic', async () => {
  const s = await mockAdapter().summarize({ title: 'T', text: 'Eins. Zwei! Drei? Vier.' });
  expect(s).toBe('Eins. Zwei! Drei?');
  expect(await mockAdapter().summarize({ title: 'T', text: '' })).toBe('T');
});

test('mock clustering groups similar titles, every article once', async () => {
  const clusters = await mockAdapter().cluster(arts);
  expect(clusters.map((c) => c.articles.length)).toEqual([2, 1]);
});

test('createAi: mock without key, gemini with key', () => {
  expect(createAi({}).provider).toBe('mock');
  expect(createAi({ GEMINI_API_KEY: 'k' }).provider).toBe('gemini');
});

const reply = (text: string) =>
  (async () => Response.json({ candidates: [{ content: { parts: [{ text }] } }] })) as unknown as typeof fetch;

test('gemini summary sends key header and returns text', async () => {
  let headers: Headers | undefined;
  const f = (async (_u: string, init: RequestInit) => {
    headers = new Headers(init.headers);
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Kurzfassung' }] } }] });
  }) as unknown as typeof fetch;
  expect(await geminiAdapter('secret', f).summarize({ title: 'T', text: 'x' })).toBe('Kurzfassung');
  expect(headers?.get('x-goog-api-key')).toBe('secret');
});

test('gemini clustering: parses groups, keeps dropped articles', async () => {
  const raw = JSON.stringify([{ title: 'Klima', summary: 'S', ids: [0, 1] }]);
  const clusters = await geminiAdapter('k', reply(raw)).cluster(arts);
  expect(clusters.map((c) => [c.title, c.articles.length])).toEqual([['Klima', 2], [arts[2]!.title, 1]]);
});

test('gemini clustering falls back to mock on bad output', async () => {
  const clusters = await geminiAdapter('k', reply('kein json')).cluster(arts);
  expect(clusters).toHaveLength(2);
});
