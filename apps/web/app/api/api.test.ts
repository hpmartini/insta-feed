import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resetDbForTests } from "@/lib/db";
import { POST as register } from "./auth/register/route";
import { POST as login } from "./auth/login/route";
import { POST as logout } from "./auth/logout/route";
import { GET as me } from "./auth/me/route";
import { GET as listFeeds, POST as createFeed } from "./feeds/route";
import { DELETE as removeFeed, PATCH as patchFeed } from "./feeds/[id]/route";
import { GET as articles } from "./articles/route";
import { POST as summary } from "./ai/summary/route";
import { GET as clusters } from "./ai/clusters/route";
import { GET as article } from "./article/route";
import { GET as settings, PUT as putSettings } from "./settings/route";

const realFetch = globalThis.fetch;
const RSS = (items: string[]) => `<?xml version="1.0"?><rss version="2.0"><channel>${items.map((t, i) => `<item><title>${t}</title><link>https://n.test/${i}</link><description>Satz eins. Satz zwei. Satz drei. Satz vier.</description><pubDate>Mon, 06 Oct 2025 1${i}:00:00 GMT</pubDate></item>`).join("")}</channel></rss>`;

beforeEach(() => {
  resetDbForTests();
  // no network: feeds are served from memory; example.com / news.test resolve through the stub below
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("broken")) return new Response("nope", { status: 500 });
    return new Response(RSS(["Bundestag beschließt Klimagesetz", "Bundestag beschließt neues Klimagesetz", "Wetter morgen sonnig"]));
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const req = (url: string, init: Omit<RequestInit, "body"> & { cookie?: string; body?: unknown } = {}) =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.cookie ? { cookie: init.cookie } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

async function signUp(email = "a@example.com") {
  const res = await register(req("/api/auth/register", { method: "POST", body: { email, password: "geheim1234" } }), undefined);
  expect(res.status).toBe(201);
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}

describe("API auth", () => {
  test("every protected route answers 401 without a session", async () => {
    const calls: Array<Promise<Response>> = [
      me(req("/api/auth/me"), undefined),
      listFeeds(req("/api/feeds"), undefined),
      createFeed(req("/api/feeds", { method: "POST", body: { name: "x", url: "https://x.test" } }), undefined),
      patchFeed(req("/api/feeds/1", { method: "PATCH", body: {} }), { params: Promise.resolve({ id: "1" }) }),
      removeFeed(req("/api/feeds/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) }),
      articles(req("/api/articles"), undefined),
      article(req("/api/article?url=https://x.test"), undefined),
      summary(req("/api/ai/summary", { method: "POST", body: {} }), undefined),
      clusters(req("/api/ai/clusters"), undefined),
      settings(req("/api/settings"), undefined),
      putSettings(req("/api/settings", { method: "PUT", body: {} }), undefined),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });

  test("cookie is httpOnly + SameSite=Lax; login/logout cycle", async () => {
    const res = await register(req("/api/auth/register", { method: "POST", body: { email: "a@example.com", password: "geheim1234" } }), undefined);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly.*SameSite=Lax/);
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    expect((await me(req("/api/auth/me", { cookie }), undefined)).status).toBe(200);

    const bad = await login(req("/api/auth/login", { method: "POST", body: { email: "a@example.com", password: "falsch1234" } }), undefined);
    expect(bad.status).toBe(401);
    const ok = await login(req("/api/auth/login", { method: "POST", body: { email: "a@example.com", password: "geheim1234" } }), undefined);
    expect(ok.status).toBe(200);

    expect((await logout(req("/api/auth/logout", { method: "POST", cookie }), undefined)).status).toBe(200);
    expect((await me(req("/api/auth/me", { cookie }), undefined)).status).toBe(401);
  });

  test("bad JSON -> 400", async () => {
    const res = await register(new Request("http://localhost/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: "{kaputt" }), undefined);
    expect(res.status).toBe(400);
  });
});

describe("API feeds, articles, AI, settings", () => {
  test("feed CRUD over HTTP handlers, 404 for foreign feed", async () => {
    const cookie = await signUp();
    const created = await createFeed(req("/api/feeds", { method: "POST", cookie, body: { name: "News", url: "https://news.test/rss" } }), undefined);
    expect(created.status).toBe(201);
    const feed = await created.json();
    expect((await listFeeds(req("/api/feeds", { cookie }), undefined).then((r) => r.json())).length).toBe(1);

    const ctx = { params: Promise.resolve({ id: String(feed.id) }) };
    expect((await patchFeed(req(`/api/feeds/${feed.id}`, { method: "PATCH", cookie, body: { subscribed: false } }), ctx).then((r) => r.json())).subscribed).toBe(false);

    const other = await signUp("b@example.com");
    expect((await patchFeed(req(`/api/feeds/${feed.id}`, { method: "PATCH", cookie: other, body: { name: "x" } }), ctx)).status).toBe(404);
    expect((await removeFeed(req(`/api/feeds/${feed.id}`, { method: "DELETE", cookie: other }), ctx)).status).toBe(404);
    expect((await removeFeed(req(`/api/feeds/${feed.id}`, { method: "DELETE", cookie }), ctx)).status).toBe(204);
  });

  test("articles: subscribed feeds only, newest first, filter by feed, partial failure", async () => {
    const cookie = await signUp();
    const post = (name: string, url: string) => createFeed(req("/api/feeds", { method: "POST", cookie, body: { name, url } }), undefined).then((r) => r.json());
    const good = await post("Gut", "https://news.test/rss");
    await post("Kaputt", "https://news.test/broken");
    const off = await post("Aus", "https://off.test/rss");
    await patchFeed(req(`/api/feeds/${off.id}`, { method: "PATCH", cookie, body: { subscribed: false } }), { params: Promise.resolve({ id: String(off.id) }) });

    const all = await articles(req("/api/articles", { cookie }), undefined).then((r) => r.json());
    expect(all.items.map((i: { feedName: string }) => i.feedName)).toEqual(["Gut", "Gut", "Gut"]);
    expect(all.items[0].publishedAt >= all.items[1].publishedAt).toBe(true);
    expect(all.errors).toEqual([{ feedId: expect.any(Number), feedName: "Kaputt", error: expect.any(String) }]);

    const one = await articles(req(`/api/articles?feedId=${good.id}`, { cookie }), undefined).then((r) => r.json());
    expect(one.items).toHaveLength(3);
    expect((await articles(req("/api/articles?feedId=999", { cookie }), undefined)).status).toBe(404);
  });

  test("summary (mock, cached) and story clusters (mock)", async () => {
    const cookie = await signUp();
    const body = { url: "https://n.test/1", title: "T", content: "<p>Eins. Zwei. Drei. Vier.</p>" };
    const r1 = await summary(req("/api/ai/summary", { method: "POST", cookie, body }), undefined).then((r) => r.json());
    expect(r1.summary).toBe("Eins. Zwei. Drei.");
    // cached: same url returns the first answer even with different content
    const r2 = await summary(req("/api/ai/summary", { method: "POST", cookie, body: { ...body, content: "Anders." } }), undefined).then((r) => r.json());
    expect(r2.summary).toBe("Eins. Zwei. Drei.");

    await createFeed(req("/api/feeds", { method: "POST", cookie, body: { name: "A", url: "https://news.test/a" } }), undefined);
    const { stories } = await clusters(req("/api/ai/clusters", { cookie }), undefined).then((r) => r.json());
    expect(stories[0].items).toHaveLength(2);
    expect(stories[0].title).toContain("Klimagesetz");
  });

  test("full-text proxy refuses internal targets", async () => {
    const cookie = await signUp();
    const res = await article(req("/api/article?url=http://169.254.169.254/", { cookie }), undefined);
    expect(res.status).toBe(400);
  });

  test("settings round trip and validation", async () => {
    const cookie = await signUp();
    expect((await settings(req("/api/settings", { cookie }), undefined).then((r) => r.json())).theme).toBe("system");
    const saved = await putSettings(req("/api/settings", { method: "PUT", cookie, body: { theme: "dark", view: "cards", refreshMinutes: 5, speed: 7 } }), undefined).then((r) => r.json());
    expect(saved).toMatchObject({ theme: "dark", view: "cards", refreshMinutes: 5, speed: 7 });
    expect((await putSettings(req("/api/settings", { method: "PUT", cookie, body: { theme: "x" } }), undefined)).status).toBe(400);
  });
});

test("JSON endpoints refuse form posts (login CSRF)", async () => {
  const res = await login(
    new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "email=a%40example.com&password=geheim1234" }),
    undefined,
  );
  expect(res.status).toBe(415);
});
