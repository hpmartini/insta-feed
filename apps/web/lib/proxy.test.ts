import { describe, expect, test } from "bun:test";
import { assertPublicUrl, extractArticle, isPrivateIp, loadArticle, safeFetchText } from "./proxy";

const pub = async () => ["93.184.216.34"];

describe("SSRF guard", () => {
  test.each([
    "http://localhost/x",
    "http://foo.localhost/x",
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://drucker.local/",
    "http://2130706433/", // decimal form of 127.0.0.1, normalised by URL
    "file:///etc/passwd",
    "ftp://example.com/",
    "javascript:alert(1)",
    "kein url",
  ])("rejects %s", async (url) => {
    await expect(assertPublicUrl(url, pub)).rejects.toMatchObject({ status: 400 });
  });

  test("rejects a public-looking name that resolves to a private address", async () => {
    await expect(assertPublicUrl("http://evil.test/", async () => ["93.184.216.34", "10.0.0.5"])).rejects.toMatchObject({ status: 400 });
  });

  test("accepts public http(s)", async () => {
    expect((await assertPublicUrl("https://example.com/a", pub)).hostname).toBe("example.com");
    expect(isPrivateIp("93.184.216.34")).toBe(false);
    expect(isPrivateIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  test("redirect to a private address is blocked", async () => {
    const fetchStub = (async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })) as unknown as typeof fetch;
    await expect(safeFetchText("https://example.com/", { fetch: fetchStub, resolve: pub })).rejects.toMatchObject({ status: 400 });
  });

  test("follows a public redirect and returns the body", async () => {
    let n = 0;
    const fetchStub = (async () =>
      n++ === 0 ? new Response(null, { status: 301, headers: { location: "/neu" } }) : new Response("hallo")) as unknown as typeof fetch;
    expect(await safeFetchText("https://example.com/alt", { fetch: fetchStub, resolve: pub })).toEqual({ text: "hallo", url: "https://example.com/neu" });
  });

  test("body over 2 MB is rejected", async () => {
    const big = (async () => new Response("x".repeat(2 * 1024 * 1024 + 1))) as unknown as typeof fetch;
    await expect(safeFetchText("https://example.com/", { fetch: big, resolve: pub })).rejects.toMatchObject({ status: 502 });
  });
});

describe("article extraction", () => {
  const html = `<html><head><title>Titel</title></head><body><nav>Menü</nav><article><h1>Titel</h1>
    <p>${"Das ist ein langer Absatz mit viel Inhalt. ".repeat(10)}<script>alert(1)</script></p>
    <p onclick="x()">${"Zweiter Absatz, ebenfalls lang genug für Readability. ".repeat(10)}</p></article></body></html>`;

  test("returns plain-text paragraphs without markup", async () => {
    const a = await loadArticle("https://example.com/a", { fetch: (async () => new Response(html)) as unknown as typeof fetch, resolve: pub });
    expect(a.title).toBe("Titel");
    expect(a.paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(a.paragraphs.join(" ")).not.toMatch(/<|alert\(1\)|onclick/);
  });

  test("falls back to stripped text when Readability finds nothing", () => {
    const a = extractArticle("<html><body><div>kurz</div></body></html>");
    expect(a.paragraphs).toEqual(["kurz"]);
  });
});
