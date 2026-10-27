import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Article } from "@/lib/types";
import { assertHttpUrl } from "./rss";

export function extractArticle(html: string, url: string): Article {
  const { document } = parseHTML(html);
  const fallbackTitle = document.querySelector("title")?.textContent?.trim() || url;
  const parsed = new Readability(document as unknown as Document).parse();
  const content = parsed?.textContent?.replace(/\s+/g, " ").trim();
  if (!parsed || !content) throw new Error("Artikel konnte nicht gelesen werden");
  return {
    url,
    title: parsed.title?.trim() || fallbackTitle,
    siteName: parsed.siteName ?? null,
    excerpt: parsed.excerpt ?? null,
    content,
  };
}

export async function fetchArticle(url: string, fetchImpl: typeof fetch = fetch): Promise<Article> {
  const res = await fetchImpl(assertHttpUrl(url), {
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "InstaFeed/2.0" },
  });
  if (!res.ok) throw new Error(`Artikel-Abruf fehlgeschlagen: HTTP ${res.status}`);
  return extractArticle(await res.text(), url);
}
