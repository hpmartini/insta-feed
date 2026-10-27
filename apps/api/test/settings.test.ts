import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTINGS } from "@insta-feed/shared";
import { createApp } from "../src/app";
import { migrate, openDb } from "../src/db";

const open: Database[] = [];
const dirs: string[] = [];
afterEach(() => {
  open.splice(0).forEach((d) => d.close());
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

const boom = () => { throw new Error("unexpected I/O"); };

function appOn(db: Database, clock = { t: new Date("2026-01-01T00:00:00Z") }) {
  const app = createApp({
    db,
    fetch: boom as unknown as typeof fetch,
    ai: { provider: "mock", model: "m", summarize: boom as never },
    now: () => clock.t,
  });
  const call = (method: string, path: string, o: { body?: unknown; cookie?: string; origin?: string } = {}) =>
    app(new Request(`http://api.test${path}`, {
      method,
      headers: { ...(o.cookie && { cookie: o.cookie }), ...(o.origin && { origin: o.origin }) },
      body: typeof o.body === "string" ? o.body : o.body === undefined ? undefined : JSON.stringify(o.body),
    }));
  return { call, clock };
}

async function setup() {
  const db = openDb(":memory:");
  open.push(db);
  migrate(db);
  const { call, clock } = appOn(db);
  const signup = async (email: string) => {
    const r = await call("POST", "/auth/register", { body: { email, password: "password1" } });
    return { cookie: r.headers.get("set-cookie")!.split(";")[0]!, id: ((await r.json()) as { id: string }).id };
  };
  const mkFeed = async (u: { cookie: string }, url: string) =>
    ((await (await call("POST", "/feeds", { cookie: u.cookie, body: { url, title: "F" } })).json()) as { id: string }).id;
  return { db, call, clock, mkFeed, a: await signup("a@x.test"), b: await signup("b@x.test") };
}

const rows = (db: Database, uid?: string) =>
  (db.query(`select count(*) c from settings ${uid ? "where user_id = ?" : ""}`).get(...(uid ? [uid] : [])) as { c: number }).c;
const put = (s: { call: Awaited<ReturnType<typeof setup>>["call"] }, cookie: string, body: unknown) => s.call("PUT", "/settings", { cookie, body });
const full = { theme: "dark", view: "cards", refresh_minutes: 15, speed: 12.5, default_feed_id: null };

test("defaults are created lazily on first GET, once, only for the caller", async () => {
  const s = await setup();
  expect(rows(s.db)).toBe(0);
  const r = await s.call("GET", "/settings", { cookie: s.a.cookie });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual(DEFAULT_SETTINGS);
  expect(rows(s.db, s.a.id)).toBe(1);
  expect(rows(s.db, s.b.id)).toBe(0);
  await put(s, s.a.cookie, full);
  expect(await (await s.call("GET", "/settings", { cookie: s.a.cookie })).json()).toEqual(full); // GET never resets
  expect(rows(s.db)).toBe(1);
});

test("PUT roundtrip, PUT before GET, idempotent repeat", async () => {
  const s = await setup();
  const r = await put(s, s.a.cookie, full);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual(full);
  expect(await (await put(s, s.a.cookie, full)).json()).toEqual(full);
  expect(rows(s.db)).toBe(1);
});

test("speed 1 and 100 accepted; outside rejected", async () => {
  const s = await setup();
  for (const speed of [1, 100]) expect((await put(s, s.a.cookie, { ...full, speed })).status).toBe(200);
  for (const speed of [0, 0.5, 100.01, -3, "30", null]) expect((await put(s, s.a.cookie, { ...full, speed })).status).toBe(400);
  expect(((await (await s.call("GET", "/settings", { cookie: s.a.cookie })).json()) as { speed: number }).speed).toBe(100);
});

test("invalid input is 400 and changes nothing", async () => {
  const s = await setup();
  await put(s, s.a.cookie, full);
  const { theme: _t, ...missing } = full;
  const bad: unknown[] = [
    missing, { ...full, extra: 1 }, { ...full, user_id: s.b.id }, { ...full, theme: "neon" }, { ...full, view: "grid" },
    { ...full, refresh_minutes: -1 }, { ...full, refresh_minutes: 1.5 }, { ...full, refresh_minutes: 1441 },
    { ...full, default_feed_id: "" }, { ...full, default_feed_id: 5 }, "{not json", "null", [],
  ];
  for (const body of bad) expect((await put(s, s.a.cookie, body)).status).toBe(400);
  expect(await (await s.call("GET", "/settings", { cookie: s.a.cookie })).json()).toEqual(full);
});

test("401 without or with expired session; 403 for foreign origin on PUT", async () => {
  const s = await setup();
  expect((await s.call("GET", "/settings")).status).toBe(401);
  expect((await s.call("PUT", "/settings", { body: full })).status).toBe(401);
  expect((await s.call("PUT", "/settings", { cookie: s.a.cookie, body: full, origin: "http://evil.test" })).status).toBe(403);
  expect((await s.call("PUT", "/settings", { cookie: s.a.cookie, body: full, origin: "http://api.test" })).status).toBe(200);
  s.clock.t = new Date("2026-01-31T00:00:00Z");
  expect((await s.call("GET", "/settings", { cookie: s.a.cookie })).status).toBe(401);
});

test("other methods are 404", async () => {
  const s = await setup();
  for (const m of ["POST", "PATCH", "DELETE"]) expect((await s.call(m, "/settings", { cookie: s.a.cookie })).status).toBe(404);
});

test("two users keep independent settings", async () => {
  const s = await setup();
  await put(s, s.a.cookie, full);
  expect(await (await s.call("GET", "/settings", { cookie: s.b.cookie })).json()).toEqual(DEFAULT_SETTINGS);
  await put(s, s.b.cookie, { ...full, theme: "light" });
  expect(((await (await s.call("GET", "/settings", { cookie: s.a.cookie })).json()) as { theme: string }).theme).toBe("dark");
});

test("default feed: own ok, foreign/unknown 404 without partial change, null resets, delete clears", async () => {
  const s = await setup();
  const mine = await s.mkFeed(s.a, "https://a.test/rss");
  const theirs = await s.mkFeed(s.b, "https://b.test/rss");
  expect(await (await put(s, s.a.cookie, { ...full, default_feed_id: mine })).json()).toEqual({ ...full, default_feed_id: mine });
  for (const id of [theirs, "nope"]) {
    expect((await put(s, s.a.cookie, { ...full, theme: "light", default_feed_id: id })).status).toBe(404);
  }
  expect(await (await s.call("GET", "/settings", { cookie: s.a.cookie })).json()).toEqual({ ...full, default_feed_id: mine });
  expect(((await (await put(s, s.a.cookie, full)).json()) as { default_feed_id: null }).default_feed_id).toBeNull();
  await put(s, s.a.cookie, { ...full, default_feed_id: mine });
  expect((await s.call("DELETE", `/feeds/${mine}`, { cookie: s.a.cookie })).status).toBe(204);
  expect(((await (await s.call("GET", "/settings", { cookie: s.a.cookie })).json()) as { default_feed_id: null }).default_feed_id).toBeNull();
});

test("settings persist across reopening the database file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "if-"));
  dirs.push(dir);
  const path = join(dir, "t.db");
  const db1 = openDb(path);
  migrate(db1);
  const one = appOn(db1);
  const r = await one.call("POST", "/auth/register", { body: { email: "a@x.test", password: "password1" } });
  const cookie = r.headers.get("set-cookie")!.split(";")[0]!;
  await one.call("PUT", "/settings", { cookie, body: full });
  db1.close();
  const db2 = openDb(path);
  open.push(db2);
  migrate(db2);
  expect(await (await appOn(db2).call("GET", "/settings", { cookie })).json()).toEqual(full);
});
