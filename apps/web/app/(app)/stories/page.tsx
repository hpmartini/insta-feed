import Link from "next/link";
import { loadStories } from "@/lib/ai";
import { formatDate, safeHref } from "@/lib/format";
import { requireUser } from "@/lib/session";

export default async function Stories() {
  const user = await requireUser();
  const { stories, errors } = await loadStories(user.id);
  const multi = stories.filter((s) => s.items.length > 1);
  const single = stories.filter((s) => s.items.length === 1);

  const title = (it: { link: string; title: string }) => {
    const href = safeHref(it.link);
    return href ? <Link href={`/articles/view?url=${encodeURIComponent(href)}`}>{it.title}</Link> : it.title;
  };

  return (
    <>
      <h1>Stories</h1>
      <p className="muted">Meldungen aus deinen abonnierten Feeds, die dasselbe Ereignis behandeln.</p>
      {errors.map((e) => <p key={e.feedId} role="alert" className="error">{e.feedName}: {e.error}</p>)}
      {stories.length === 0 && <p className="card">Keine Artikel. <Link href="/feeds">Feeds verwalten</Link></p>}
      {multi.map((s, i) => (
        <section key={i} className="card">
          <h2>{s.title} <span className="badge">{s.items.length} Meldungen</span></h2>
          {s.summary && <p>{s.summary}</p>}
          <ul>
            {s.items.map((it) => (
              <li key={it.id}>{title(it)} <span className="muted">· {it.feedName} · {formatDate(it.publishedAt)}</span></li>
            ))}
          </ul>
        </section>
      ))}
      {single.length > 0 && (
        <section className="card">
          <h2>Einzelmeldungen</h2>
          <ul>
            {single.map((s) => (
              <li key={s.items[0]!.id}>{title(s.items[0]!)} <span className="muted">· {s.items[0]!.feedName}</span></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
