import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app";
import { migrate, openDb } from "../src/db";

const open: Database[] = [];
afterEach(() => open.splice(0).forEach((d) => d.close()));

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const boom = () => { throw new Error("unexpected I/O"); };

type Handler = () => Response | Promise<Response>;

async function setup() {
  const db = openDb(":memory:");
  open.push(db);
  migrate(db);
  const routes = new Map<string, Handler>();
  const fetched: string[] = [];
  const stub = (async (input: string | URL | Request) => {
    const url = String(input);
    fetched.push(url);
    const h = routes.get(url);
    return h ? h() : new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
  const app = createApp({
    db,
    fetch: stub,
    resolve: async () => ["93.184.216.34"],
    ai: { provider: "mock", model: "m", summarize: boom as never },
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
  const call = (method: string, path: string, o: { body?: unknown; cookie?: string } = {}) =>
    app(new Request(`http://api.test${path}`, {
      method,
      headers: o.cookie ? { cookie: o.cookie } : {},
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }));
  const signup = async (email: string) => {
    const r = await call("POST", "/auth/register", { body: { email, password: "password1" } });
    return { cookie: r.headers.get("set-cookie")!.split(";")[0]! };
  };
  const addFeed = async (u: { cookie: string }, url: string) =>
    ((await (await call("POST", "/feeds", { cookie: u.cookie, body: { url, title: "F" } })).json()) as { id: string }).id;
  const xml = (body: string) => () => new Response(body, { headers: { "content-type": "application/xml" } });
  return { db, call, routes, fetched, a: await signup("a@x.test"), b: await signup("b@x.test"), addFeed, xml };
}

type ArticleOut = { id: string; feedId: string; title: string; publishedAt?: string };
const list = async (s: Awaited<ReturnType<typeof setup>>, u: { cookie: string }, q = "") =>
  (await (await s.call("GET", `/articles${q}`, { cookie: u.cookie })).json()) as ArticleOut[];

test("refresh imports RSS and Atom; repeating and overlapping imports add no duplicates", async () => {
  const s = await setup();
  const rss = await s.addFeed(s.a, "https://example.com/rss");
  s.routes.set("https://example.com/rss", s.xml(fixture("rss.xml")));
  const first = await s.call("POST", `/feeds/${rss}/refresh`, { cookie: s.a.cookie });
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({ imported: 3, feed: { id: rss } });
  expect(await (await s.call("POST", `/feeds/${rss}/refresh`, { cookie: s.a.cookie })).json()).toMatchObject({ imported: 0 });
  expect(await list(s, s.a)).toHaveLength(3);

  // Overlap: the feed grows by one item, the old ones are not re-imported.
  const grown = fixture("rss.xml").replace("</channel>", "<item><title>New</title><link>https://example.com/posts/9</link><guid>post-9</guid></item></channel>");
  s.routes.set("https://example.com/rss", s.xml(grown));
  expect(await (await s.call("POST", `/feeds/${rss}/refresh`, { cookie: s.a.cookie })).json()).toMatchObject({ imported: 1 });
  expect(await list(s, s.a)).toHaveLength(4);

  const atom = await s.addFeed(s.a, "https://example.org/atom");
  s.routes.set("https://example.org/atom", s.xml(fixture("atom.xml")));
  await s.call("POST", `/feeds/${atom}/refresh`, { cookie: s.a.cookie });
  expect(await list(s, s.a, `?feedId=${atom}`)).toHaveLength(3);
});

test("list: newest first, undated last, optional feedId filter", async () => {
  const s = await setup();
  const rss = await s.addFeed(s.a, "https://example.com/rss");
  s.routes.set("https://example.com/rss", s.xml(fixture("rss.xml")));
  await s.call("POST", `/feeds/${rss}/refresh`, { cookie: s.a.cookie });
  expect((await list(s, s.a)).map((x) => x.title)).toEqual(["Second", "First & best", "https://example.com/posts/3"]);
  expect(await list(s, s.a, "?feedId=nope")).toEqual([]);
  expect((await list(s, s.a, `?feedId=${rss}`)).every((x) => x.feedId === rss)).toBe(true);
});

test("failed refresh sets last_error on that feed only, keeps articles, success clears it", async () => {
  const s = await setup();
  const f1 = await s.addFeed(s.a, "https://example.com/rss");
  const f2 = await s.addFeed(s.a, "https://other.example.com/rss");
  s.routes.set("https://example.com/rss", s.xml(fixture("rss.xml")));
  await s.call("POST", `/feeds/${f1}/refresh`, { cookie: s.a.cookie });

  s.routes.set("https://example.com/rss", s.xml("<rss><channel><item>"));
  const bad = await s.call("POST", `/feeds/${f1}/refresh`, { cookie: s.a.cookie });
  expect(bad.status).toBe(502);
  const feeds = (await (await s.call("GET", "/feeds", { cookie: s.a.cookie })).json()) as { id: string; lastError?: string }[];
  expect(feeds.find((f) => f.id === f1)!.lastError).toBeString();
  expect(feeds.find((f) => f.id === f2)!.lastError).toBeUndefined();
  expect(await list(s, s.a)).toHaveLength(3);

  s.routes.set("https://example.com/rss", () => new Response("down", { status: 500 }));
  expect(await (await s.call("POST", `/feeds/${f1}/refresh`, { cookie: s.a.cookie })).json()).toMatchObject({ error: "HTTP 500" });

  s.routes.set("https://example.com/rss", s.xml(fixture("rss.xml")));
  const ok = (await (await s.call("POST", `/feeds/${f1}/refresh`, { cookie: s.a.cookie })).json()) as { feed: { lastError?: string } };
  expect(ok.feed.lastError).toBeUndefined();
});

test("refresh of a private feed URL is refused by safeFetch and recorded", async () => {
  const s = await setup();
  const f = await s.addFeed(s.a, "http://169.254.169.254/feed");
  const r = await s.call("POST", `/feeds/${f}/refresh`, { cookie: s.a.cookie });
  expect(r.status).toBe(502);
  expect(s.fetched).toEqual([]);
});

test("a feed deleted during the fetch is not imported", async () => {
  const s = await setup();
  const f = await s.addFeed(s.a, "https://example.com/rss");
  s.routes.set("https://example.com/rss", async () => {
    await s.call("DELETE", `/feeds/${f}`, { cookie: s.a.cookie });
    return new Response(fixture("rss.xml"));
  });
  expect((await s.call("POST", `/feeds/${f}/refresh`, { cookie: s.a.cookie })).status).toBe(409);
  expect(s.db.query("select count(*) c from articles").get()).toEqual({ c: 0 });
});

test("isolation: foreign refresh, list and content are 404/empty and never fetch", async () => {
  const s = await setup();
  const f = await s.addFeed(s.a, "https://example.com/rss");
  s.routes.set("https://example.com/rss", s.xml(fixture("rss.xml")));
  await s.call("POST", `/feeds/${f}/refresh`, { cookie: s.a.cookie });
  const [article] = await list(s, s.a);
  s.fetched.length = 0;

  expect((await s.call("POST", `/feeds/${f}/refresh`, { cookie: s.b.cookie })).status).toBe(404);
  expect(await list(s, s.b)).toEqual([]);
  expect(await list(s, s.b, `?feedId=${f}`)).toEqual([]);
  expect((await s.call("GET", `/articles/${article!.id}/content`, { cookie: s.b.cookie })).status).toBe(404);
  expect((await s.call("GET", "/articles/unknown/content", { cookie: s.a.cookie })).status).toBe(404);
  expect(s.fetched).toEqual([]);
  expect((await s.call("GET", "/articles")).status).toBe(401);
});

const PAGE = `<html><head><title>T</title><style>p{}</style></head><body>
  <nav>Menu item</nav><script>alert("x")</script>
  <article><h1>Headline</h1><p>First &amp; <b>bold</b> &#8364; paragraph.</p><p>Second&nbsp;one.</p></article>
  <footer>Imprint</footer></body></html>`;

async function withArticle(s: Awaited<ReturnType<typeof setup>>) {
  const f = await s.addFeed(s.a, "https://example.com/rss");
  s.routes.set("https://example.com/rss", s.xml(fixture("rss.xml")));
  await s.call("POST", `/feeds/${f}/refresh`, { cookie: s.a.cookie });
  const a = (await list(s, s.a)).find((x) => x.title === "First & best")!;
  return a.id;
}
const content = async (s: Awaited<ReturnType<typeof setup>>, id: string) =>
  (await s.call("GET", `/articles/${id}/content`, { cookie: s.a.cookie })).json();

test("content: extracts text from the stored link only, without scripts, styles and navigation", async () => {
  const s = await setup();
  const id = await withArticle(s);
  s.routes.set("https://example.com/posts/1", () => new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }));
  s.fetched.length = 0;
  expect(await content(s, id)).toEqual({
    text: "Headline\n\nFirst & bold € paragraph.\n\nSecond one.",
    url: "https://example.com/posts/1",
    fallback: false,
  });
  expect(s.fetched).toEqual(["https://example.com/posts/1"]);
});

test("content: void <br> elements split text instead of breaking extraction", async () => {
  const s = await setup();
  const id = await withArticle(s);
  s.routes.set("https://example.com/posts/1", () => new Response("<p>A<br>B</p>", { headers: { "content-type": "text/html" } }));
  expect(await content(s, id)).toMatchObject({ text: "A\n\nB", fallback: false });
});

test("content: fetch error, bad status, non-html and empty text fall back to snippet plus link", async () => {
  const s = await setup();
  const id = await withArticle(s);
  const expected = { text: "Hello world", url: "https://example.com/posts/1", fallback: true };
  expect(await content(s, id)).toEqual(expected); // unrouted: 404
  s.routes.set("https://example.com/posts/1", () => { throw new Error("network down"); });
  expect(await content(s, id)).toEqual(expected);
  s.routes.set("https://example.com/posts/1", () => new Response("<p>x</p>", { status: 500, headers: { "content-type": "text/html" } }));
  expect(await content(s, id)).toEqual(expected);
  s.routes.set("https://example.com/posts/1", () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }));
  expect(await content(s, id)).toEqual(expected);
  s.routes.set("https://example.com/posts/1", () => new Response("<script>x</script>", { headers: { "content-type": "text/html" } }));
  expect(await content(s, id)).toEqual(expected);
});

test("content: a stored link to a private address is never fetched", async () => {
  const s = await setup();
  const id = await withArticle(s);
  s.db.run("update articles set url = 'http://127.0.0.1:8080/admin' where id = ?", [id]);
  s.fetched.length = 0;
  expect(await content(s, id)).toMatchObject({ fallback: true, url: "http://127.0.0.1:8080/admin" });
  expect(s.fetched).toEqual([]);
});
