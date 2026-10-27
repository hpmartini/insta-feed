import Link from "next/link";
import { Suspense } from "react";
import { getAi } from "@/lib/ai";
import { fetchArticle } from "@/lib/article";
import { requireUser } from "@/lib/session";
import type { Article } from "@/lib/types";

type SearchParams = Promise<{ url?: string }>;

async function Summary({ article }: { article: Article }) {
  const ai = getAi();
  const summary = await ai.summarize({ title: article.title, content: article.content });
  return (
    <section className="card summary" aria-labelledby="summary">
      <h2 id="summary" style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
        KI-Zusammenfassung <span className="muted">({ai.name})</span>
      </h2>
      <p style={{ margin: 0 }}>{summary}</p>
    </section>
  );
}

export default async function ReadPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { url } = await searchParams;
  if (!url) return <p className="error">Keine Artikel-URL angegeben.</p>;

  let article: Article;
  try {
    // Server-side fetch is the CORS proxy: the browser never requests the foreign site.
    article = await fetchArticle(url);
  } catch (e) {
    return (
      <>
        <p className="error" role="alert">
          {e instanceof Error ? e.message : "Artikel konnte nicht geladen werden"}
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Original öffnen
        </a>
      </>
    );
  }

  return (
    <article>
      <p className="muted">{article.siteName}</p>
      <h1>{article.title}</h1>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <Link className="button" href={`/row-runner?url=${encodeURIComponent(url)}`}>
          Im Row Runner lesen
        </Link>
        <a className="button secondary" href={url} target="_blank" rel="noopener noreferrer">
          Original öffnen
        </a>
      </div>
      <Suspense fallback={<p className="card muted">Zusammenfassung wird erstellt …</p>}>
        <Summary article={article} />
      </Suspense>
      <div className="prose" lang="de">
        <p>{article.content}</p>
      </div>
    </article>
  );
}
