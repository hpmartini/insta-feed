import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, type Deps } from "../src/app";
import { MIGRATIONS, migrate, openDb, SCHEMA_VERSION } from "../src/db";

const open: Database[] = [];
const dirs: string[] = [];
const mem = () => {
  const db = openDb(":memory:");
  open.push(db);
  return db;
};
afterEach(() => {
  open.splice(0).forEach((d) => d.close());
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

const version = (db: Database) => (db.query("pragma user_version").get() as { user_version: number }).user_version;
const tables = (db: Database) =>
  (db.query("select name from sqlite_master where type='table' order by name").all() as { name: string }[]).map((r) => r.name);
const user = (db: Database, id: string) =>
  db.run("insert into users values (?, ?, 'h', '2026-01-01T00:00:00Z')", [id, `${id}@x.test`]);
const feed = (db: Database, id: string, uid: string, url = "https://f.test/rss") =>
  db.run("insert into feeds (id, user_id, url, title) values (?, ?, ?, 't')", [id, uid, url]);

test("creates six tables and version; repeat keeps data", () => {
  const db = mem();
  migrate(db);
  expect(tables(db)).toEqual(["ai_cache", "articles", "feeds", "sessions", "settings", "users"]);
  expect(version(db)).toBe(SCHEMA_VERSION);
  user(db, "u1");
  migrate(db);
  expect(db.query("select count(*) c from users").get()).toEqual({ c: 1 });
});

test("failed migration leaves no partial state; newer version rejected untouched", () => {
  const db = mem();
  expect(() => migrate(db, ["create table a (x); create table a (x);"])).toThrow();
  expect(tables(db)).toEqual([]);
  expect(version(db)).toBe(0);
  db.run("pragma user_version = 99");
  expect(() => migrate(db)).toThrow(/newer/);
  expect(tables(db)).toEqual([]);
});

test("uniqueness and foreign keys", () => {
  const db = mem();
  migrate(db);
  user(db, "u1");
  user(db, "u2");
  feed(db, "f1", "u1");
  feed(db, "f2", "u2"); // same url, other user: allowed
  expect(() => feed(db, "f3", "u1")).toThrow(); // same url, same user
  expect(() => feed(db, "f4", "nobody", "https://z.test")).toThrow();
  const art = (id: string, f: string, u: string, guid = "g") =>
    db.run("insert into articles values (?, ?, ?, ?, 'https://a.test', 't', 'c', null)", [id, f, u, guid]);
  art("a1", "f1", "u1");
  expect(() => art("a2", "f1", "u1")).toThrow(); // duplicate guid per feed
  expect(() => art("a3", "f1", "u2", "g2")).toThrow(); // feed owned by someone else
  expect(() => db.run("insert into settings (user_id, default_feed_id) values ('u2', 'f1')")).toThrow();
  db.run("delete from users where id='u1'");
  expect(db.query("select count(*) c from articles").get()).toEqual({ c: 0 });
});

test("file db survives reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "if-"));
  dirs.push(dir);
  const path = join(dir, "sub", "t.db");
  const a = openDb(path);
  migrate(a);
  user(a, "u1");
  a.close();
  const b = openDb(path);
  open.push(b);
  migrate(b);
  expect(version(b)).toBe(SCHEMA_VERSION);
  expect(b.query("select count(*) c from users").get()).toEqual({ c: 1 });
});

test("/health with injected stubs on separate dbs, no network", async () => {
  for (const db of [mem(), mem()]) {
    migrate(db);
    const deps: Deps = {
      db,
      fetch: (() => { throw new Error("network"); }) as unknown as typeof fetch,
      ai: { provider: "mock", model: "m", summarize: async () => ({ text: "x" }) },
      now: () => new Date(0),
    };
    const body = (await (await createApp(deps)(new Request("http://x/health"))).json()) as { ok: boolean; sqlite: string };
    expect(body.ok).toBe(true);
    expect(body.sqlite).toMatch(/^\d+\.\d+/);
  }
});

test("v1 data survives the v2 migration; last_error starts empty", () => {
  const db = mem();
  migrate(db, MIGRATIONS.slice(0, 1));
  expect(version(db)).toBe(1);
  user(db, "u1");
  feed(db, "f1", "u1");
  db.run("insert into articles values ('a1', 'f1', 'u1', 'g', 'https://f.test/1', 't', 'c', null)");
  migrate(db, MIGRATIONS.slice(0, 2));
  expect(version(db)).toBe(2);
  expect(db.query("select last_error from feeds where id = ?").get("f1")).toEqual({ last_error: null });
  expect(db.query("select count(*) c from articles").get()).toEqual({ c: 1 });
});

test("v3 adds settings columns, keeps speed/feed, clamps old speed", () => {
  const db = mem();
  migrate(db, MIGRATIONS.slice(0, 2));
  for (const u of ["u1", "u2"]) user(db, u);
  feed(db, "f1", "u1");
  db.run("insert into settings (user_id, speed, default_feed_id) values ('u1', 55, 'f1'), ('u2', 500, null)");
  migrate(db);
  migrate(db);
  expect(version(db)).toBe(3);
  expect(db.query("select * from settings order by user_id").all()).toEqual([
    { user_id: "u1", speed: 55, default_feed_id: "f1", theme: "system", view: "list", refresh_minutes: 0 },
    { user_id: "u2", speed: 100, default_feed_id: null, theme: "system", view: "list", refresh_minutes: 0 },
  ]);
});
