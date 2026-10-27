import Link from "next/link";
import SummaryButton from "@/components/SummaryButton";
import { safeHref } from "@/lib/format";
import { loadArticle, type Article } from "@/lib/proxy";
import { requireUser } from "@/lib/session";

export default async function ArticleView({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  await requireUser();
  const { url = "" } = await searchParams;
  let article: Article | undefined;
  let error = "";
  try {
    article = await loadArticle(url);
  } catch (e) {
    error = e instanceof Error ? e.message : "Fehler";
  }
  const href = safeHref(url);

  return (
    <article className="reader">
      <p><Link href="/articles">← Zurück</Link></p>
      {error && <p role="alert" className="error">Volltext nicht verfügbar: {error}</p>}
      {article && (
        <>
          <h1>{article.title}</h1>
          {article.siteName && <p className="muted">{article.siteName}</p>}
          <SummaryButton url={url} title={article.title} text={article.paragraphs.join(" ")} />
          {article.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </>
      )}
      {href && <p><a href={href} target="_blank" rel="noopener noreferrer">Original öffnen</a></p>}
    </article>
  );
}
