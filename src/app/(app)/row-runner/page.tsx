import RowRunner from "@/components/RowRunner";
import { fetchArticle } from "@/lib/article";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

type SearchParams = Promise<{ url?: string }>;

export default async function RowRunnerPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { url } = await searchParams;
  if (!url) return <p className="muted">Wähle einen Artikel aus der Übersicht und öffne ihn im Row Runner.</p>;

  try {
    const article = await fetchArticle(url);
    return <RowRunner title={article.title} text={article.content} speed={getSettings(getDb(), user.id).speed} />;
  } catch (e) {
    return (
      <p className="error" role="alert">
        {e instanceof Error ? e.message : "Artikel konnte nicht geladen werden"}
      </p>
    );
  }
}
