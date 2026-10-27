import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../src/app";
import { migrate, openDb } from "../src/db";

const open: Database[] = [];
afterEach(() => open.splice(0).forEach((d) => d.close()));

const boom = () => { throw new Error("unexpected I/O"); };

async function setup() {
  const db = openDb(":memory:");
  open.push(db);
  migrate(db);
  const app = createApp({
    db,
    fetch: boom as unknown as typeof fetch,
    ai: { provider: "mock", model: "m", summarize: boom as never },
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
  const call = (method: string, path: string, o: { body?: unknown; cookie?: string; origin?: string } = {}) =>
    app(new Request(`http://api.test${path}`, {
      method,
      headers: { ...(o.cookie && { cookie: o.cookie }), ...(o.origin && { origin: o.origin }) },
      body: typeof o.body === "string" ? o.body : o.body === undefined ? undefined : JSON.stringify(o.body),
    }));
  const signup = async (email: string) => {
    const r = await call("POST", "/auth/register", { body: { email, password: "password1" } });
    return { cookie: r.headers.get("set-cookie")!.split(";")[0]!, id: ((await r.json()) as { id: string }).id };
  };
  return { db, call, a: await signup("a@x.test"), b: await signup("b@x.test") };
}

const feed = { url: "https://example.com/rss", title: "Example" };

test("lifecycle: create, read, list, patch, delete", async () => {
  const { call, a } = await setup();
  const r = await call("POST", "/feeds", { cookie: a.cookie, body: { ...feed, title: "  Example  ", iconUrl: "https://example.com/i.png" } });
  expect(r.status).toBe(201);
  const f = (await r.json()) as Record<string, unknown> & { id: string };
  expect(f).toEqual({ id: expect.any(String), userId: a.id, url: feed.url, title: "Example", iconUrl: "https://example.com/i.png", subscribed: true });
  expect(await (await call("GET", `/feeds/${f.id}`, { cookie: a.cookie })).json()).toEqual(f);
  expect(await (await call("GET", "/feeds", { cookie: a.cookie })).json()).toEqual([f]);

  const p = await call("PATCH", `/feeds/${f.id}`, { cookie: a.cookie, body: { title: "New" } });
  expect(p.status).toBe(200);
  expect(await p.json()).toEqual({ ...f, title: "New" });
  const noIcon = await call("PATCH", `/feeds/${f.id}`, { cookie: a.cookie, body: { iconUrl: null } });
  expect(await noIcon.json()).toEqual({ id: f.id, userId: a.id, url: feed.url, title: "New", subscribed: true });

  expect((await call("DELETE", `/feeds/${f.id}`, { cookie: a.cookie })).status).toBe(204);
  expect((await call("GET", `/feeds/${f.id}`, { cookie: a.cookie })).status).toBe(404);
  expect(await (await call("GET", "/feeds", { cookie: a.cookie })).json()).toEqual([]);
});

test("subscribe/unsubscribe is idempotent, keeps articles, unsubscribed feeds stay listed", async () => {
  const { call, db, a } = await setup();
  const f = (await (await call("POST", "/feeds", { cookie: a.cookie, body: { ...feed, subscribed: false } })).json()) as { id: string; subscribed: boolean };
  expect(f.subscribed).toBe(false);
  db.run("insert into articles values ('x', ?, ?, 'g', 'https://example.com/1', 't', 'c', null)", [f.id, a.id]);
  for (const subscribed of [true, true, false, false]) {
    const r = await call("PATCH", `/feeds/${f.id}`, { cookie: a.cookie, body: { subscribed } });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { subscribed: boolean }).subscribed).toBe(subscribed);
  }
  expect(((await (await call("GET", "/feeds", { cookie: a.cookie })).json()) as unknown[]).length).toBe(1);
  expect(db.query("select count(*) c from articles").get()).toEqual({ c: 1 });
});

test("foreign and unknown ids → 404 on read/patch/delete/subscribe; data untouched; list isolated", async () => {
  const { call, db, a, b } = await setup();
  const f = (await (await call("POST", "/feeds", { cookie: a.cookie, body: feed })).json()) as { id: string };
  expect(await (await call("GET", "/feeds", { cookie: b.cookie })).json()).toEqual([]);
  for (const id of [f.id, "nope"]) {
    expect((await call("GET", `/feeds/${id}`, { cookie: b.cookie })).status).toBe(404);
    expect((await call("PATCH", `/feeds/${id}`, { cookie: b.cookie, body: { title: "x" } })).status).toBe(404);
    expect((await call("PATCH", `/feeds/${id}`, { cookie: b.cookie, body: { subscribed: false } })).status).toBe(404);
    expect((await call("PATCH", `/feeds/${id}`, { cookie: b.cookie, body: "garbage" })).status).toBe(404);
    expect((await call("DELETE", `/feeds/${id}`, { cookie: b.cookie })).status).toBe(404);
  }
  expect(db.query("select title, subscribed, user_id from feeds").all()).toEqual([{ title: "Example", subscribed: 1, user_id: a.id }]);
});

test("url unique per user: 409 on create and patch, same url for another user is fine", async () => {
  const { call, a, b } = await setup();
  await call("POST", "/feeds", { cookie: a.cookie, body: feed });
  expect((await call("POST", "/feeds", { cookie: a.cookie, body: feed })).status).toBe(409);
  expect((await call("POST", "/feeds", { cookie: b.cookie, body: feed })).status).toBe(201);
  const other = (await (await call("POST", "/feeds", { cookie: a.cookie, body: { url: "https://example.com/2", title: "Two" } })).json()) as { id: string };
  expect((await call("PATCH", `/feeds/${other.id}`, { cookie: a.cookie, body: { url: feed.url, title: "changed" } })).status).toBe(409);
  const after = (await (await call("GET", `/feeds/${other.id}`, { cookie: a.cookie })).json()) as { url: string; title: string };
  expect(after).toMatchObject({ url: "https://example.com/2", title: "Two" });
});

test("invalid input → 400 and nothing changes", async () => {
  const { call, db, a } = await setup();
  const post = (body: unknown) => call("POST", "/feeds", { cookie: a.cookie, body });
  for (const body of [
    "{not json", "null", "[]", {}, { url: feed.url }, { title: "t" },
    { ...feed, title: "   " }, { ...feed, title: 1 }, { ...feed, url: "ftp://example.com/x" }, { ...feed, url: "javascript:alert(1)" },
    { ...feed, url: "nope" }, { ...feed, iconUrl: "file:///etc/passwd" }, { ...feed, subscribed: "yes" },
    { ...feed, id: "mine" }, { ...feed, userId: "u" }, { ...feed, user_id: "u" }, { ...feed, extra: 1 },
  ]) expect([body, (await post(body)).status]).toEqual([body, 400]);
  expect(db.query("select count(*) c from feeds").get()).toEqual({ c: 0 });

  const f = (await (await post(feed)).json()) as { id: string };
  for (const body of ["", "null", "[]", {}, { title: "" }, { url: null }, { subscribed: null }, { id: "x" }, { userId: "x" }, { user_id: "x" }, { url: "ftp://x.test" }]) {
    const r = await call("PATCH", `/feeds/${f.id}`, { cookie: a.cookie, body });
    expect([body, r.status]).toEqual([body, 400]);
  }
  expect(db.query("select id, user_id, url, title from feeds").all()).toEqual([{ id: f.id, user_id: a.id, url: feed.url, title: "Example" }]);
});

test("owner comes from session, 401 without session, 403 foreign origin", async () => {
  const { call, db, a } = await setup();
  expect((await call("GET", "/feeds")).status).toBe(401);
  expect((await call("POST", "/feeds", { body: feed })).status).toBe(401);
  expect((await call("POST", "/feeds", { cookie: a.cookie, origin: "http://evil.test", body: feed })).status).toBe(403);
  expect((await call("POST", "/feeds", { cookie: a.cookie, origin: "http://api.test", body: feed })).status).toBe(201);
  expect(db.query("select user_id from feeds").all()).toEqual([{ user_id: a.id }]);
  expect((await call("PUT", "/feeds", { cookie: a.cookie })).status).toBe(404);
  expect((await call("GET", "/feeds/a/b", { cookie: a.cookie })).status).toBe(404);
});

test("deleting the default feed clears own setting and cascades articles; others untouched", async () => {
  const { call, db, a, b } = await setup();
  const mk = async (c: string) => ((await (await call("POST", "/feeds", { cookie: c, body: feed })).json()) as { id: string }).id;
  const fa = await mk(a.cookie), fb = await mk(b.cookie);
  db.run("insert into settings (user_id, default_feed_id) values (?, ?), (?, ?)", [a.id, fa, b.id, fb]);
  db.run("insert into articles values ('x', ?, ?, 'g', 'https://example.com/1', 't', 'c', null), ('y', ?, ?, 'g', 'https://example.com/1', 't', 'c', null)", [fa, a.id, fb, b.id]);
  expect((await call("DELETE", `/feeds/${fa}`, { cookie: a.cookie })).status).toBe(204);
  expect(db.query("select user_id, default_feed_id from settings order by user_id = ?").all(a.id)).toEqual(
    expect.arrayContaining([{ user_id: a.id, default_feed_id: null }, { user_id: b.id, default_feed_id: fb }]));
  expect(db.query("select id from articles").all()).toEqual([{ id: "y" }]);
  expect(db.query("select id from feeds").all()).toEqual([{ id: fb }]);
});
