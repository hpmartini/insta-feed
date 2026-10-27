import { describe, expect, test } from "bun:test";
import { extractArticle, fetchArticle } from "./article";

const para = "This is a reasonably long paragraph of article text, written so Readability treats it as content. ";
const HTML = `<!doctype html><html><head><title>Page Title</title></head><body>
  <nav><a href="/">Home</a> <a href="/about">About</a></nav>
  <article>
    <h1>The Headline</h1>
    <p>${para.repeat(3)}</p>
    <p>${para.repeat(3)}</p>
    <p>Final   paragraph
       with   odd whitespace. ${para.repeat(2)}</p>
  </article>
  <footer>Copyright</footer>
</body></html>`;

describe("extractArticle", () => {
  test("extracts title and collapsed text", () => {
    const a = extractArticle(HTML, "https://news.test/a");
    expect(a.url).toBe("https://news.test/a");
    expect(a.title).toBeTruthy();
    expect(a.content).toContain("Final paragraph with odd whitespace.");
    expect(a.content).not.toMatch(/\s{2,}/);
    expect(a.content).not.toContain("Copyright");
  });

  test("throws when nothing readable", () => {
    expect(() => extractArticle("<html><body></body></html>", "https://x.test")).toThrow(
      "Artikel konnte nicht gelesen werden",
    );
  });
});

describe("fetchArticle", () => {
  test("fetches and extracts", async () => {
    let calledWith = "";
    const stub = (async (input: RequestInfo | URL) => {
      calledWith = String(input);
      return new Response(HTML);
    }) as typeof fetch;
    const a = await fetchArticle("https://news.test/a", stub);
    expect(calledWith).toBe("https://news.test/a");
    expect(a.content).toContain("Readability treats it as content");
  });

  test("rejects bad scheme and HTTP errors", async () => {
    const stub = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchArticle("javascript:alert(1)", stub)).rejects.toThrow();
    await expect(fetchArticle("https://news.test/a", stub)).rejects.toThrow("500");
  });
});
