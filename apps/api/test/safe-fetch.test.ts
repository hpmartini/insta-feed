import { expect, test } from "bun:test";
import { isPublicIp, safeFetch, type Resolver } from "../src/safe-fetch";

const pub: Resolver = async () => ["93.184.216.34"];
const boom = (() => { throw new Error("fetch must not be called"); }) as unknown as typeof fetch;
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });

test("blocks non-http(s) schemes and url credentials without fetching", async () => {
  for (const u of ["file:///etc/passwd", "ftp://example.com/x", "javascript:alert(1)", "data:text/plain,hi", "not a url", "https://user:pw@example.com/"]) {
    await expect(safeFetch(u, { fetch: boom, resolve: pub })).rejects.toThrow();
  }
});

test("blocks private, loopback and link-local IP literals in all spellings", async () => {
  const bad = [
    "http://127.0.0.1/", "http://127.1/", "http://2130706433/", "http://0x7f.0.0.1/", "http://0177.0.0.1/",
    "http://10.0.0.5/", "http://172.16.0.1/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1/", "http://0.0.0.0/", "http://[::1]/", "http://[::]/", "http://[fe80::1]/", "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://[::ffff:10.0.0.1]/", "http://[2002:7f00:1::]/", "http://[64:ff9b::7f00:1]/",
  ];
  for (const u of bad) await expect(safeFetch(u, { fetch: boom, resolve: boom as never })).rejects.toThrow();
});

test("isPublicIp accepts public addresses", () => {
  for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:2800:220:1:248:1893:25c8:1946", "::ffff:8.8.8.8"]) expect(isPublicIp(ip)).toBe(true);
  for (const ip of ["", "garbage", "2001:db8::1", "224.0.0.1"]) expect(isPublicIp(ip)).toBe(false);
});

test("rejects hostnames resolving to private, mixed, empty or failing answers", async () => {
  for (const addrs of [["127.0.0.1"], ["93.184.216.34", "10.0.0.1"], ["::1"], []]) {
    await expect(safeFetch("http://example.test/", { fetch: boom, resolve: async () => addrs })).rejects.toThrow();
  }
  const failing: Resolver = async () => { throw new Error("ENOTFOUND"); };
  await expect(safeFetch("http://example.test/", { fetch: boom, resolve: failing })).rejects.toThrow("dns failed");
});

test("returns bounded body, sends no cookies, calls fetch with manual redirects", async () => {
  let init: RequestInit | undefined;
  const f = (async (_u: string, i?: RequestInit) => { init = i; return new Response("hi", { headers: { "content-type": "text/plain" } }); }) as unknown as typeof fetch;
  const r = await safeFetch("https://example.test/a", { fetch: f, resolve: pub });
  expect(r).toEqual({ status: 200, url: "https://example.test/a", contentType: "text/plain", text: "hi" });
  expect(init).toMatchObject({ redirect: "manual", credentials: "omit" });
});

test("follows three redirects, rejects the fourth and private targets", async () => {
  const chain = (n: number): typeof fetch =>
    (async (u: string) => {
      const i = Number(new URL(u).pathname.slice(1) || 0);
      return i < n ? redirect(`/${i + 1}`) : new Response("end");
    }) as unknown as typeof fetch;
  expect((await safeFetch("http://a.test/", { fetch: chain(3), resolve: pub })).text).toBe("end");
  await expect(safeFetch("http://a.test/", { fetch: chain(4), resolve: pub })).rejects.toThrow("too many redirects");

  let calls = 0;
  const toPrivate = (async () => { calls++; return redirect("http://169.254.169.254/"); }) as unknown as typeof fetch;
  await expect(safeFetch("http://a.test/", { fetch: toPrivate, resolve: pub })).rejects.toThrow("not allowed");
  expect(calls).toBe(1);
  const toHost = (async (u: string) => (u.includes("evil") ? new Response("x") : redirect("http://evil.test/"))) as unknown as typeof fetch;
  const perHost: Resolver = async (h) => (h === "evil.test" ? ["10.0.0.1"] : ["93.184.216.34"]);
  await expect(safeFetch("http://a.test/", { fetch: toHost, resolve: perHost })).rejects.toThrow("not allowed");
});

test("enforces the size limit while streaming, ignoring Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(c) { c.enqueue(new Uint8Array(1024)); },
    cancel() { cancelled = true; },
  });
  const f = (async () => new Response(body, { headers: { "content-length": "10" } })) as unknown as typeof fetch;
  await expect(safeFetch("http://a.test/", { fetch: f, resolve: pub, maxBytes: 4096 })).rejects.toThrow("too large");
  expect(cancelled).toBe(true);
});

test("times out on a stalled resolver, a stalled response and a slow body", async () => {
  const never = new Promise<never>(() => {});
  await expect(safeFetch("http://a.test/", { fetch: boom, resolve: () => never, timeoutMs: 30 })).rejects.toThrow("timeout");
  await expect(safeFetch("http://a.test/", { fetch: (() => never) as unknown as typeof fetch, resolve: pub, timeoutMs: 30 })).rejects.toThrow("timeout");
  const slow = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
  const f = (async () => new Response(slow)) as unknown as typeof fetch;
  await expect(safeFetch("http://a.test/", { fetch: f, resolve: pub, timeoutMs: 30 })).rejects.toThrow("timeout");
});
