import { describe, expect, test } from "bun:test";
import { assertHttpUrl, isPrivateIp, safeFetch } from "./net";

const PUBLIC_DNS = async () => ["93.184.216.34"];

describe("assertHttpUrl", () => {
  test("accepts http(s)", () => {
    expect(assertHttpUrl("https://a.test/x").hostname).toBe("a.test");
    expect(assertHttpUrl("http://172.32.0.1").hostname).toBe("172.32.0.1");
  });

  test("rejects other schemes, garbage and internal hosts", () => {
    for (const u of ["file:///etc/passwd", "javascript:alert(1)", "not a url"]) expect(() => assertHttpUrl(u)).toThrow();
    for (const u of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://169.254.169.254", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://printer.local"]) {
      expect(() => assertHttpUrl(u)).toThrow("Interne");
    }
  });
});

test("isPrivateIp", () => {
  for (const ip of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.0.1", "224.0.0.1", "::", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::7f00:1", "64:ff9b::7f00:1", "2002:7f00:1::"]) {
    expect(isPrivateIp(ip)).toBe(true);
  }
  for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2a00:1450:4001::1"]) expect(isPrivateIp(ip)).toBe(false);
});

describe("safeFetch", () => {
  test("rejects hosts that resolve to internal IPs", async () => {
    const stub = (async () => new Response("x")) as unknown as typeof fetch;
    await expect(safeFetch("https://evil.test/", { fetch: stub, resolve: async () => ["127.0.0.1"] })).rejects.toThrow("Interne");
    await expect(safeFetch("https://evil.test/", { fetch: stub, resolve: async () => [] })).rejects.toThrow("Interne");
  });

  test("follows public redirects but re-validates every hop", async () => {
    const seen: string[] = [];
    const stub = (async (input: URL) => {
      seen.push(String(input));
      if (input.pathname === "/start") return new Response(null, { status: 301, headers: { location: "/next" } });
      if (input.pathname === "/next") return new Response("ok");
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    }) as unknown as typeof fetch;

    expect(await (await safeFetch("https://a.test/start", { fetch: stub, resolve: PUBLIC_DNS })).text()).toBe("ok");
    expect(seen).toEqual(["https://a.test/start", "https://a.test/next"]);
    await expect(safeFetch("https://a.test/evil", { fetch: stub, resolve: PUBLIC_DNS })).rejects.toThrow("Interne");
  });

  test("stops redirect loops", async () => {
    const stub = (async () => new Response(null, { status: 302, headers: { location: "/loop" } })) as unknown as typeof fetch;
    await expect(safeFetch("https://a.test/loop", { fetch: stub, resolve: PUBLIC_DNS })).rejects.toThrow("Weiterleitungen");
  });
});
