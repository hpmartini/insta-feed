import { expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const req = (path: string, init: { method?: string; origin?: string; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3000", ...(init.origin !== undefined && { origin: init.origin }), ...(init.cookie && { cookie: init.cookie }) },
  });

test("API: fremder und null-Origin bei Schreibzugriff → 403, eigener/fehlender erlaubt", () => {
  expect(middleware(req("/api/feeds", { method: "POST", origin: "http://evil.com" })).status).toBe(403);
  expect(middleware(req("/api/feeds", { method: "POST", origin: "null" })).status).toBe(403);
  expect(middleware(req("/api/feeds", { method: "POST", origin: "http://localhost:3000" })).status).toBe(200);
  expect(middleware(req("/api/feeds", { method: "POST" })).status).toBe(200);
  expect(middleware(req("/api/feeds", { origin: "http://evil.com" })).status).toBe(200); // GET
});

test("API-Pfade werden nie umgeleitet; Origin wird auf Backend umgeschrieben", () => {
  const res = middleware(req("/api/auth/me"));
  expect(res.status).toBe(200);
  expect(res.headers.get("location")).toBeNull();
  const post = middleware(req("/api/feeds", { method: "POST", origin: "http://localhost:3000" }));
  expect(post.headers.get("x-middleware-request-origin")).toBe("http://localhost:3001");
});

test("Seiten: ohne Cookie → /login (mit next), /login und /register offen, mit Cookie durch", () => {
  const r = middleware(req("/feeds?x=1"));
  expect(r.status).toBe(307);
  const loc = new URL(r.headers.get("location")!);
  expect(loc.pathname + loc.search).toBe("/login?next=%2Ffeeds%3Fx%3D1");
  expect(middleware(req("/")).headers.get("location")).toContain("/login");
  expect(middleware(req("/login")).status).toBe(200);
  expect(middleware(req("/register")).status).toBe(200);
  expect(middleware(req("/feeds", { cookie: "session=abc" })).status).toBe(200);
});

test("localPath: nur lokale Pfade", async () => {
  const { localPath } = await import("./components/auth-form");
  expect(localPath("/feeds?x=1")).toBe("/feeds?x=1");
  for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "", null]) expect(localPath(bad)).toBe("/");
});
