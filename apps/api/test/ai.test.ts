import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../src/app";
import { AiProviderError, PROMPT_VERSION, type AiAdapter } from "../src/ai/adapter";
import { createAiAdapter } from "../src/ai/factory";
import { GEMINI_MODEL, GeminiAdapter, type GeminiClient } from "../src/ai/gemini";
import { MockAdapter } from "../src/ai/mock";
import { migrate, openDb } from "../src/db";

const open: Database[] = [];
afterEach(() => open.splice(0).forEach((d) => d.close()));

const NOW = new Date("2026-01-01T00:00:00Z");

async function setup(ai: AiAdapter) {
  const db = openDb(":memory:");
  open.push(db);
  migrate(db);
  const app = createApp({ db, fetch: (() => { throw new Error("unexpected I/O"); }) as never, ai, now: () => NOW });
  const call = (method: string, path: string, o: { body?: unknown; cookie?: string; origin?: string } = {}) =>
    app(new Request(`http://api.test${path}`, {
      method,
      headers: { ...(o.cookie && { cookie: o.cookie }), ...(o.origin && { origin: o.origin }) },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }));
  const signup = async (email: string) => {
    const r = await call("POST", "/auth/register", { body: { email, password: "password1" } });
    const cookie = r.headers.get("set-cookie")!.split(";")[0]!;
    const user = (await r.json()) as { id: string };
    return { cookie, id: user.id };
  };
  const a = await signup("a@x.test");
  const b = await signup("b@x.test");
  const feed = (u: { id: string }, id: string, title: string) =>
    db.run("insert into feeds (id, user_id, url, title) values (?, ?, ?, ?)", [id, u.id, `https://${id}.test/rss`, title]);
  const article = (u: { id: string }, feedId: string, id: string, title: string, content: string, publishedAt: string | null = "2025-12-31T12:00:00Z") =>
    db.run("insert into articles (id, feed_id, user_id, guid, url, title, content, published_at) values (?, ?, ?, ?, ?, ?, ?, ?)", [
      id, feedId, u.id, id, `https://${feedId}.test/${id}`, title, content, publishedAt,
    ]);
  const cacheRows = () => (db.query("select count(*) as n from ai_cache").get() as { n: number }).n;
  return { db, call, a, b, feed, article, cacheRows };
}

type Stub = { calls: number; reply: () => Promise<{ text?: string }>; params: Parameters<GeminiClient["models"]["generateContent"]>[0][] };
function geminiStub(reply: Stub["reply"]) {
  const stub: Stub = { calls: 0, reply, params: [] };
  const client: GeminiClient = { models: { generateContent: async (p) => (stub.calls++, stub.params.push(p), stub.reply()) } };
  return { stub, adapter: new GeminiAdapter(client) };
}

test("mock: deterministic, offline, depends only on input", async () => {
  const m = new MockAdapter();
  const input = { title: "Hello", content: "  some\n text " };
  expect(await m.summarize(input)).toEqual(await m.summarize(input));
  expect(await m.summarize(input)).toEqual({ text: "Hello: some text" });
  expect(await m.summarize({ title: "", content: "" })).toEqual({ text: "Untitled" });
  expect((await m.summarize({ title: "T", content: "x".repeat(1000) })).text.length).toBeLessThan(300);
});

test("factory: mock forced, key selects gemini, no key falls back to mock", () => {
  expect(createAiAdapter({}).provider).toBe("mock");
  expect(createAiAdapter({ geminiApiKey: "  " }).provider).toBe("mock");
  expect(createAiAdapter({ provider: "mock", geminiApiKey: "k" }).provider).toBe("mock");
  expect(createAiAdapter({ provider: "MOCK ", geminiApiKey: "k" }).provider).toBe("mock");
  const g = createAiAdapter({ geminiApiKey: "k" });
  expect([g.provider, g.model]).toEqual(["gemini", GEMINI_MODEL]);
  expect(createAiAdapter({ provider: "gemini", geminiApiKey: "k" }).provider).toBe("gemini");
});

test("gemini: request carries model and JSON schema; response is validated", async () => {
  const { stub, adapter } = geminiStub(async () => ({ text: '{"text":"Kurz."}' }));
  expect(await adapter.summarize({ title: "T", content: "C" })).toEqual({ text: "Kurz." });
  const p = stub.params[0]!;
  expect(p.model).toBe("gemini-2.5-flash");
  expect(p.config.responseMimeType).toBe("application/json");
  expect(p.config.responseSchema).toMatchObject({ required: ["text"] });
  expect(p.contents).toContain("C");
});

test("gemini: transport error, empty text, bad JSON, schema violation → AiProviderError without secrets", async () => {
  const replies: Stub["reply"][] = [
    async () => { throw new Error("fetch failed key=SECRET123"); },
    async () => ({}),
    async () => ({ text: "not json" }),
    async () => ({ text: '{"text":""}' }),
    async () => ({ text: '{"summary":"x"}' }),
    async () => ({ text: "[]" }),
  ];
  for (const reply of replies) {
    const err = await geminiStub(reply).adapter.summarize({ title: "T", content: "C" }).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.message).not.toContain("SECRET123");
  }
});

test("summary route: 401, foreign origin, unknown and foreign article → no provider call", async () => {
  const { stub, adapter } = geminiStub(async () => ({ text: '{"text":"S"}' }));
  const s = await setup(adapter);
  s.feed(s.a, "fa", "Feed A");
  s.article(s.a, "fa", "a1", "Title", "Body");
  expect((await s.call("POST", "/articles/a1/summary")).status).toBe(401);
  expect((await s.call("POST", "/articles/a1/summary", { cookie: s.a.cookie, origin: "https://evil.test" })).status).toBe(403);
  expect((await s.call("POST", "/articles/nope/summary", { cookie: s.a.cookie })).status).toBe(404);
  expect((await s.call("POST", "/articles/a1/summary", { cookie: s.b.cookie })).status).toBe(404);
  expect(stub.calls).toBe(0);
  expect(s.cacheRows()).toBe(0);
});

test("summary route: success is labelled, cached, and the hit skips the provider", async () => {
  const { stub, adapter } = geminiStub(async () => ({ text: '{"text":"S"}' }));
  const s = await setup(adapter);
  s.feed(s.a, "fa", "Feed A");
  s.article(s.a, "fa", "a1", "Title", "Body");
  const res = await s.call("POST", "/articles/a1/summary", { cookie: s.a.cookie });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    articleId: "a1",
    text: "S",
    sources: [{ name: "Feed A", url: "https://fa.test/a1", origin: "feed" }],
    provider: "gemini",
    model: GEMINI_MODEL,
    promptVersion: PROMPT_VERSION,
    createdAt: NOW.toISOString(),
  });
  const again = await s.call("POST", "/articles/a1/summary", { cookie: s.a.cookie });
  expect(again.status).toBe(200);
  expect(stub.calls).toBe(1);
  expect(s.cacheRows()).toBe(1);
});

test("summary route: provider failures → 502, nothing cached, no mock fallback, retry works", async () => {
  let fail = true;
  const { stub, adapter } = geminiStub(async () => {
    if (fail) throw new Error("boom key=SECRET123");
    return { text: '{"text":"S"}' };
  });
  const s = await setup(adapter);
  s.feed(s.a, "fa", "F");
  s.article(s.a, "fa", "a1", "Title", "Body");
  const bad = await s.call("POST", "/articles/a1/summary", { cookie: s.a.cookie });
  expect(bad.status).toBe(502);
  expect(JSON.stringify(await bad.json())).not.toContain("SECRET123");
  expect(s.cacheRows()).toBe(0);
  fail = false;
  const ok = await s.call("POST", "/articles/a1/summary", { cookie: s.a.cookie });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toMatchObject({ provider: "gemini", text: "S" });
  expect(stub.calls).toBe(2);
});

test("summary route: schema violation from the adapter → 502, nothing cached", async () => {
  const { adapter } = geminiStub(async () => ({ text: '{"text":""}' }));
  const s = await setup(adapter);
  s.feed(s.a, "fa", "F");
  s.article(s.a, "fa", "a1", "Title", "Body");
  expect((await s.call("POST", "/articles/a1/summary", { cookie: s.a.cookie })).status).toBe(502);
  expect(s.cacheRows()).toBe(0);
});

test("cache key: title, content, provider, model, prompt version each invalidate; users isolated", async () => {
  let calls = 0;
  const mk = (provider: AiAdapter["provider"], model: string): AiAdapter => ({
    provider, model, summarize: async ({ title }) => (calls++, { text: `${provider}/${model}/${title}` }),
  });
  const s = await setup(mk("mock", "m1"));
  s.feed(s.a, "fa", "F");
  s.article(s.a, "fa", "a1", "T", "C");
  const post = (id: string, cookie = s.a.cookie) => s.call("POST", `/articles/${id}/summary`, { cookie });
  await post("a1");
  await post("a1");
  expect(calls).toBe(1);

  s.db.run("update articles set content = 'C2' where id = 'a1'");
  await post("a1");
  s.db.run("update articles set title = 'T2' where id = 'a1'");
  await post("a1");
  expect(calls).toBe(3);

  // Other provider/model share the table but never the entry.
  for (const ai of [mk("gemini", "m1"), mk("mock", "m2")]) {
    const app = createApp({ db: s.db, fetch: fetch, ai, now: () => NOW });
    const r = await app(new Request("http://api.test/articles/a1/summary", { method: "POST", headers: { cookie: s.a.cookie } }));
    expect(((await r.json()) as { text: string }).text).toBe(`${ai.provider}/${ai.model}/T2`);
  }
  expect(calls).toBe(5);

  // Stale prompt version rows are ignored.
  s.db.run("update ai_cache set prompt_version = 'old'");
  await post("a1");
  expect(calls).toBe(6);

  // Same content for user b: own entry, own identity and sources.
  s.feed(s.b, "fb", "Feed B");
  s.article(s.b, "fb", "b1", "T2", "C2");
  const rb = (await (await post("b1", s.b.cookie)).json()) as { articleId: string; sources: { url: string }[] };
  expect(calls).toBe(7);
  expect(rb).toMatchObject({ articleId: "b1", sources: [{ url: "https://fb.test/b1" }] });
});

test("cache hit never leaks another article's identity or sources; corrupt entry is a miss", async () => {
  let calls = 0;
  const ai: AiAdapter = { provider: "mock", model: "m", summarize: async () => (calls++, { text: "S" }) };
  const s = await setup(ai);
  s.feed(s.a, "fa", "Feed A");
  s.feed(s.a, "fb", "Feed B");
  s.article(s.a, "fa", "a1", "Same", "Same body");
  s.article(s.a, "fb", "a2", "Same", "Same body");
  const post = async (id: string) => (await (await s.call("POST", `/articles/${id}/summary`, { cookie: s.a.cookie })).json()) as { articleId: string; sources: { name: string }[] };
  expect(await post("a1")).toMatchObject({ articleId: "a1", sources: [{ name: "Feed A" }] });
  expect(await post("a2")).toMatchObject({ articleId: "a2", sources: [{ name: "Feed B" }] });
  expect(calls).toBe(1);

  s.db.run("update ai_cache set result = '{\"text\":123}'");
  expect(await post("a1")).toMatchObject({ articleId: "a1" });
  expect(calls).toBe(2);
});

test("stories: only own recent articles, merged sources, labelled as local heuristic", async () => {
  const s = await setup(new MockAdapter());
  s.feed(s.a, "fa", "Feed A");
  s.feed(s.a, "fb", "Feed B");
  s.feed(s.b, "fc", "Feed C");
  s.article(s.a, "fa", "a1", "Big storm hits coast", "", "2025-12-31T12:00:00Z");
  s.article(s.a, "fb", "a2", "Big storm hits coast!", "", "2025-12-31T10:00:00Z");
  s.article(s.a, "fa", "old", "Big storm hits coast", "", "2025-12-01T10:00:00Z");
  s.article(s.b, "fc", "c1", "Big storm hits coast", "", "2025-12-31T11:00:00Z");
  expect((await s.call("GET", "/stories")).status).toBe(401);
  const res = await s.call("GET", "/stories", { cookie: s.a.cookie });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject([
    {
      title: "Big storm hits coast",
      articleIds: ["a1", "a2"],
      sources: [{ name: "Feed A", url: "https://fa.test/a1" }, { name: "Feed B", url: "https://fb.test/a2" }],
      provider: "mock",
      model: "jaccard-v1",
      promptVersion: "jaccard-v1",
      createdAt: NOW.toISOString(),
    },
  ]);
  const empty = await s.call("GET", "/stories", { cookie: s.b.cookie });
  expect(((await empty.json()) as unknown[]).length).toBe(1); // b sees only c1
  expect(((await (await s.call("GET", "/stories", { cookie: s.b.cookie })).json()) as { articleIds: string[] }[])[0]!.articleIds).toEqual(["c1"]);
});
