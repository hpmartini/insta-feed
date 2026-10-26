import { beforeEach, expect, test } from 'bun:test';
import { mockAdapter } from './ai';
import { createApp } from './app';
import { openDb } from './db';

const FEED_XML = (title: string, date: string) =>
  `<rss><channel><item><title>${title}</title><link>https://news.example/${title}</link><pubDate>${date}</pubDate><description>${title} Text.</description></item></channel></rss>`;
const PAGE = '<html><head><title>Seite</title></head><body><article><h1>Seite</h1><p>' + 'Langer Absatz mit Inhalt. '.repeat(40) + '</p></article></body></html>';

const fakeFetch = (async (url: string) => {
  if (url.includes('a.example')) return new Response(FEED_XML('Alpha', '2024-01-01'));
  if (url.includes('b.example')) return new Response(FEED_XML('Beta', '2024-02-01'));
  if (url.includes('news.example')) return new Response(PAGE);
  return new Response('nope', { status: 404 });
}) as unknown as typeof fetch;

let app: (r: Request) => Promise<Response>;
let cookie = '';

async function call(method: string, path: string, body?: unknown) {
  const res = await app(new Request(`http://t/api${path}`, {
    method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0]!;
  return { status: res.status, body: (await res.json()) as any };
}
const signup = (email = 'a@b.de') => call('POST', '/auth/register', { email, password: 'geheim123', name: 'A' });

beforeEach(() => {
  app = createApp({ db: openDb(':memory:'), ai: mockAdapter(), fetchImpl: fakeFetch });
  cookie = '';
});

test('auth: protected without session, register/login/logout cycle', async () => {
  expect((await call('GET', '/feeds')).status).toBe(401);
  expect((await signup()).status).toBe(201);
  expect((await call('GET', '/auth/me')).body.user.email).toBe('a@b.de');
  await call('POST', '/auth/logout');
  expect((await call('GET', '/auth/me')).status).toBe(401);
  expect((await call('POST', '/auth/login', { email: 'a@b.de', password: 'falsch123' })).status).toBe(401);
  expect((await call('POST', '/auth/login', { email: 'a@b.de', password: 'geheim123' })).status).toBe(200);
  expect((await call('GET', '/auth/me')).status).toBe(200);
});

test('auth: validation and duplicate email', async () => {
  expect((await call('POST', '/auth/register', { email: 'x', password: 'geheim123' })).status).toBe(400);
  expect((await call('POST', '/auth/register', { email: 'a@b.de', password: 'kurz' })).status).toBe(400);
  await signup();
  expect((await signup()).status).toBe(409);
});

test('feeds: add, edit, unsubscribe, delete; private URLs rejected', async () => {
  await signup();
  const { body } = await call('POST', '/feeds', { name: 'A', url: 'https://a.example/rss', icon: 'x.png' });
  const id = body.feed.id;
  expect(body.feed).toMatchObject({ name: 'A', subscribed: true, icon: 'x.png' });
  expect((await call('POST', '/feeds', { name: 'A', url: 'https://a.example/rss' })).status).toBe(409);
  expect((await call('POST', '/feeds', { name: 'L', url: 'http://localhost/rss' })).status).toBe(400);
  expect((await call('PATCH', `/feeds/${id}`, { name: 'A2', subscribed: false })).body.feed)
    .toMatchObject({ name: 'A2', subscribed: false });
  expect((await call('GET', '/feeds')).body.feeds).toHaveLength(1);
  await call('DELETE', `/feeds/${id}`);
  expect((await call('GET', '/feeds')).body.feeds).toHaveLength(0);
  expect((await call('DELETE', `/feeds/${id}`)).status).toBe(404);
});

test('feeds belong to their user', async () => {
  await signup('one@b.de');
  const id = (await call('POST', '/feeds', { name: 'A', url: 'https://a.example/rss' })).body.feed.id;
  await signup('two@b.de');
  expect((await call('GET', '/feeds')).body.feeds).toHaveLength(0);
  expect((await call('PATCH', `/feeds/${id}`, { name: 'x' })).status).toBe(404);
});

test('articles: merged newest first from subscribed feeds only, filter by feed', async () => {
  await signup();
  const a = (await call('POST', '/feeds', { name: 'A', url: 'https://a.example/rss' })).body.feed;
  const b = (await call('POST', '/feeds', { name: 'B', url: 'https://b.example/rss' })).body.feed;
  const titles = async (q = '') => (await call('GET', `/articles${q}`)).body.articles.map((x: any) => x.title);
  expect(await titles()).toEqual(['Beta', 'Alpha']);
  expect(await titles(`?feedId=${a.id}`)).toEqual(['Alpha']);
  await call('PATCH', `/feeds/${b.id}`, { subscribed: false });
  expect(await titles()).toEqual(['Alpha']);
});

test('article proxy extracts readable text; blocks private hosts', async () => {
  await signup();
  const r = await call('GET', `/article?url=${encodeURIComponent('https://news.example/x')}`);
  expect(r.status).toBe(200);
  expect(r.body.content).toContain('Langer Absatz');
  expect((await call('GET', `/article?url=${encodeURIComponent('http://127.0.0.1/x')}`)).status).toBe(400);
});

test('ai endpoints use mock without key', async () => {
  await signup();
  await call('POST', '/feeds', { name: 'A', url: 'https://a.example/rss' });
  const s = await call('POST', '/ai/summary', { url: 'u', title: 'T', text: 'Eins. Zwei.' });
  expect(s.body).toEqual({ summary: 'Eins. Zwei.', provider: 'mock' });
  const c = await call('GET', '/ai/clusters');
  expect(c.body.provider).toBe('mock');
  expect(c.body.clusters).toHaveLength(1);
});

test('settings: defaults, merge, ignores unknown keys and wrong types', async () => {
  await signup();
  expect((await call('GET', '/settings')).body.settings.theme).toBe('light');
  const r = await call('PUT', '/settings', { theme: 'dark', speed: 'schnell', evil: 1 });
  expect(r.body.settings).toMatchObject({ theme: 'dark', speed: 30 });
  expect(r.body.settings.evil).toBeUndefined();
  expect((await call('PUT', '/settings', { theme: 'pink' })).body.settings.theme).toBe('light');
});
