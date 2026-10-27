import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../src/app";
import { migrate, openDb } from "../src/db";

const open: Database[] = [];
afterEach(() => open.splice(0).forEach((d) => d.close()));

function setup() {
  const db = openDb(":memory:");
  open.push(db);
  migrate(db);
  const clock = { t: new Date("2026-01-01T00:00:00Z") };
  const app = createApp({
    db,
    fetch: (() => { throw new Error("network"); }) as unknown as typeof fetch,
    ai: { provider: "mock", model: "m", summarize: async () => "" },
    now: () => clock.t,
  });
  const call = (method: string, path: string, o: { body?: unknown; cookie?: string; origin?: string } = {}) =>
    app(new Request(`http://api.test${path}`, {
      method,
      headers: { ...(o.cookie && { cookie: o.cookie }), ...(o.origin && { origin: o.origin }) },
      body: typeof o.body === "string" ? o.body : o.body === undefined ? undefined : JSON.stringify(o.body),
    }));
  return { db, clock, call };
}
const cookieOf = (r: Response) => r.headers.get("set-cookie")!.split(";")[0]!;
const creds = (email = "a@x.test", password = "password1") => ({ email, password });

test("register logs in; /auth/me; email normalized; duplicate 409; hash is argon2id; only token digest stored", async () => {
  const { db, call } = setup();
  const r = await call("POST", "/auth/register", { body: creds("  A@X.test ") });
  expect(r.status).toBe(201);
  const sc = r.headers.get("set-cookie")!;
  expect(sc).toMatch(/HttpOnly/);
  expect(sc).toMatch(/SameSite=Lax/);
  expect(sc).toMatch(/Path=\//);
  expect(sc).toMatch(/Max-Age=2592000/);
  expect(sc).toContain("Expires=Sat, 31 Jan 2026 00:00:00 GMT");
  expect(sc).not.toMatch(/Secure/);
  const me = await call("GET", "/auth/me", { cookie: cookieOf(r) });
  expect(await me.json()).toMatchObject({ email: "a@x.test" });
  expect(JSON.stringify(await (await call("GET", "/auth/me", { cookie: cookieOf(r) })).json())).not.toMatch(/hash|password/);
  expect((await call("POST", "/auth/register", { body: creds("a@x.test") })).status).toBe(409);
  const u = db.query("select password_hash from users").get() as { password_hash: string };
  expect(u.password_hash).toStartWith("$argon2id$");
  const token = cookieOf(r).split("=")[1]!;
  const rows = db.query("select token_hash from sessions").all() as { token_hash: string }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]!.token_hash).not.toBe(token);
  expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
});

test("login: right/wrong password/unknown user; independent tokens", async () => {
  const { call } = setup();
  await call("POST", "/auth/register", { body: creds() });
  const a = await call("POST", "/auth/login", { body: creds() });
  const b = await call("POST", "/auth/login", { body: creds("A@x.test") });
  expect([a.status, b.status]).toEqual([200, 200]);
  expect(cookieOf(a)).not.toBe(cookieOf(b));
  expect((await call("POST", "/auth/login", { body: creds("a@x.test", "wrongpass1") })).status).toBe(401);
  expect((await call("POST", "/auth/login", { body: creds("nobody@x.test") })).status).toBe(401);
});

test("session expires at exactly 30 days", async () => {
  const { call, clock } = setup();
  const c = cookieOf(await call("POST", "/auth/register", { body: creds() }));
  clock.t = new Date("2026-01-30T23:59:59.999Z");
  expect((await call("GET", "/auth/me", { cookie: c })).status).toBe(200);
  clock.t = new Date("2026-01-31T00:00:00Z");
  expect((await call("GET", "/auth/me", { cookie: c })).status).toBe(401);
});

test("401 without valid cookie on every non-public route", async () => {
  const { call } = setup();
  for (const [m, p] of [["GET", "/auth/me"], ["POST", "/auth/logout"], ["GET", "/feeds"], ["GET", "/nope"]] as const) {
    expect((await call(m, p)).status).toBe(401);
    expect((await call(m, p, { cookie: "session=bogus" })).status).toBe(401);
    expect((await call(m, p, { cookie: "other=1; session" })).status).toBe(401);
  }
  expect((await call("GET", "/health")).status).toBe(200);
});

test("logout deletes only own session and clears cookie", async () => {
  const { db, call } = setup();
  const a = cookieOf(await call("POST", "/auth/register", { body: creds("a@x.test") }));
  const b = cookieOf(await call("POST", "/auth/register", { body: creds("b@x.test") }));
  expect(await (await call("GET", "/auth/me", { cookie: b })).json()).toMatchObject({ email: "b@x.test" });
  const out = await call("POST", "/auth/logout", { cookie: a });
  expect(out.status).toBe(204);
  expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  expect(db.query("select count(*) c from sessions").get()).toEqual({ c: 1 });
  expect((await call("GET", "/auth/me", { cookie: a })).status).toBe(401);
  expect((await call("GET", "/auth/me", { cookie: b })).status).toBe(200);
});

test("origin check on mutating requests, no side effects when rejected", async () => {
  const { db, call } = setup();
  for (const origin of ["http://evil.test", "null", "garbage"]) {
    for (const p of ["/auth/register", "/auth/login", "/auth/logout"]) {
      expect((await call("POST", p, { body: creds(), origin })).status).toBe(403);
    }
  }
  expect(db.query("select (select count(*) from users) u, (select count(*) from sessions) s").get()).toEqual({ u: 0, s: 0 });
  expect((await call("POST", "/auth/register", { body: creds(), origin: "http://api.test" })).status).toBe(201);
  expect((await call("GET", "/health", { origin: "http://evil.test" })).status).toBe(200);
});

test("malformed input gives 4xx, not 500", async () => {
  const { call } = setup();
  for (const body of ["{", "null", "[]", { email: 1, password: "password1" }, { email: "a@x.test", password: 5 },
    { email: "not-an-email", password: "password1" }, creds("a@x.test", "short"), creds("a@x.test", "x".repeat(257))]) {
    expect((await call("POST", "/auth/register", { body })).status).toBe(400);
    expect((await call("POST", "/auth/login", { body })).status).toBe(401);
  }
});
