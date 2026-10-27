import { describe, expect, test } from "bun:test";
import { ApiError, createApiClient } from "./index";

type Call = { url: string; init?: RequestInit };
const user = { id: "u1", email: "a@b.de", createdAt: "2026-01-01T00:00:00.000Z" };
const feed = { id: "f1", userId: "u1", url: "https://e.com/rss", title: "T", subscribed: true };
const settings = { theme: "dark", view: "cards", refresh_minutes: 0, speed: 30, default_feed_id: null } as const;
const article = { id: "a1", feedId: "f1", guid: "g", url: "https://e.com/a", title: "t", content: "c" };
const source = { name: "n", url: "https://e.com/a", origin: "feed" };
const gen = { provider: "mock", model: "m", promptVersion: "1", createdAt: "2026-01-01T00:00:00.000Z" };

function setup(res: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const api = createApiClient("/api//", async (url, init) => (calls.push({ url, init }), res()));
  return { api, calls };
}
const ok = (body: unknown, status = 200) => () => Response.json(body, { status });

describe("requests", () => {
  const cases: [string, (a: ReturnType<typeof setup>["api"]) => Promise<unknown>, unknown, string, string, unknown?][] = [
    ["health", (a) => a.health(), { ok: true, sqlite: "3" }, "GET", "/api/health"],
    ["register", (a) => a.register({ email: "a@b.de", password: "password1" }), user, "POST", "/api/auth/register", { email: "a@b.de", password: "password1" }],
    ["login", (a) => a.login({ email: "a@b.de", password: "password1" }), user, "POST", "/api/auth/login", { email: "a@b.de", password: "password1" }],
    ["me", (a) => a.me(), user, "GET", "/api/auth/me"],
    ["listFeeds", (a) => a.listFeeds(), [feed], "GET", "/api/feeds"],
    ["createFeed", (a) => a.createFeed({ url: feed.url, title: "T", iconUrl: null }), feed, "POST", "/api/feeds", { url: feed.url, title: "T", iconUrl: null }],
    ["getFeed", (a) => a.getFeed("a/b c"), feed, "GET", "/api/feeds/a%2Fb%20c"],
    ["updateFeed", (a) => a.updateFeed("f1", { title: "X" }), feed, "PATCH", "/api/feeds/f1", { title: "X" }],
    ["setSubscribed", (a) => a.setSubscribed("f1", false), feed, "PATCH", "/api/feeds/f1", { subscribed: false }],
    ["refreshFeed", (a) => a.refreshFeed("f1"), { feed, imported: 2 }, "POST", "/api/feeds/f1/refresh"],
    ["listArticles", (a) => a.listArticles(), [article], "GET", "/api/articles"],
    ["listArticles filter", (a) => a.listArticles({ feedId: "a&b=c" }), [article], "GET", "/api/articles?feedId=a%26b%3Dc"],
    ["articleContent", (a) => a.articleContent("a1"), { text: "x", url: article.url, fallback: false }, "GET", "/api/articles/a1/content"],
    ["summarize", (a) => a.summarize("a1"), { articleId: "a1", text: "s", sources: [source], ...gen }, "POST", "/api/articles/a1/summary"],
    ["listStories", (a) => a.listStories(), [{ id: "s", title: "t", articleIds: ["a1"], sources: [source], ...gen }], "GET", "/api/stories"],
    ["getSettings", (a) => a.getSettings(), settings, "GET", "/api/settings"],
    ["putSettings", (a) => a.putSettings(settings), settings, "PUT", "/api/settings", settings],
  ];
  for (const [name, call, body, method, url, sent] of cases) {
    test(name, async () => {
      const { api, calls } = setup(ok(body));
      expect(await call(api)).toEqual(body as never);
      const c = calls[0]!;
      expect([c.init?.method, c.url, c.init?.credentials]).toEqual([method, url, "same-origin"]);
      expect(c.init?.body === undefined ? undefined : JSON.parse(c.init.body as string)).toEqual(sent);
      expect(c.init?.headers !== undefined).toBe(sent !== undefined);
    });
  }

  test("204 methods resolve without parsing", async () => {
    const { api, calls } = setup(() => new Response(null, { status: 204 }));
    expect(await api.logout()).toBeUndefined();
    expect(await api.deleteFeed("f1")).toBeUndefined();
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([["POST", "/api/auth/logout"], ["DELETE", "/api/feeds/f1"]]);
  });
});

describe("errors", () => {
  const fail = async (res: () => Response | Promise<Response>) => {
    const err = await setup(res).api.me().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    return err as ApiError;
  };

  for (const status of [400, 401, 403, 404, 409]) {
    test(`http ${status}`, async () => {
      const e = await fail(ok({ error: "boom" }, status));
      expect([e.kind, e.status, e.message]).toEqual(["http", status, "boom"]);
    });
  }
  test("400 keeps issues", async () => {
    expect((await fail(ok({ error: "invalid input", issues: [{ path: ["url"] }] }, 400))).issues).toEqual([{ path: ["url"] }]);
  });
  test("plain-text and empty error bodies", async () => {
    expect((await fail(() => new Response("not found", { status: 404 }))).message).toBe("not found");
    expect((await fail(() => new Response("", { status: 500 }))).message).toBe("HTTP 500");
    expect((await fail(() => new Response("{oops", { status: 500 }))).message).toBe("{oops");
  });
  test("502 refresh details", async () => {
    const body = { feed: { ...feed, lastError: "HTTP 500" }, imported: 0, error: "HTTP 500" };
    const err = await setup(ok(body, 502)).api.refreshFeed("f1").catch((e) => e);
    expect([err.kind, err.status, err.message, err.refresh]).toEqual(["http", 502, "HTTP 500", { feed: body.feed, imported: 0 }]);
  });
  test("network error keeps cause", async () => {
    const cause = new TypeError("down");
    const e = await fail(() => { throw cause; });
    expect([e.kind, e.status, e.cause]).toEqual(["network", 0, cause]);
  });
  test("invalid success payloads", async () => {
    expect((await fail(ok({ nope: 1 }))).kind).toBe("response");
    expect((await fail(() => new Response("<html>", { status: 200 }))).kind).toBe("response");
    expect((await fail(() => new Response(null, { status: 204 }))).kind).toBe("response");
  });
});

// Compile-time contract: bad inputs must not type-check (checked by `bun run typecheck`).
export function _typeContract() {
  const api = createApiClient();
  // @ts-expect-error password missing
  void api.login({ email: "a@b.de" });
  // @ts-expect-error owner fields are not accepted
  void api.createFeed({ url: "https://e.com", title: "t", userId: "x" });
  // @ts-expect-error url required on create
  void api.createFeed({ title: "t" });
  // @ts-expect-error settings must be complete
  void api.putSettings({ theme: "dark" });
  const settings: Promise<import("@insta-feed/shared").Settings> = api.getSettings();
  void settings;
}
