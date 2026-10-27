import Link from "next/link";
import SummaryButton from "@/components/SummaryButton";
import { loadArticles } from "@/lib/articles";
import { formatDate, safeHref } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { listFeeds } from "@/lib/feeds";

export default async function Articles({ searchParams }: { searchParams: Promise<{ feed?: string }> }) {
  const user = await requireUser();
  const settings = getSettings(user.id);
  const feeds = listFeeds(user.id);
  const { feed = "" } = await searchParams;
  // ?feed=all overrides the default feed from the settings
  const wanted = feed === "all" ? undefined : Number(feed) || settings.defaultFeedId || undefined;
  const active = feeds.find((f) => f.id === wanted);
  const { items, errors } = await loadArticles(user.id, active?.id);
  const icons = new Map(feeds.map((f) => [f.id, f.icon]));

  return (
    <>
      <h1>Artikel</h1>
      {feeds.length === 0 ? (
        <p className="card">Noch keine Feeds. <Link href="/feeds">Feed hinzufügen</Link></p>
      ) : (
        <div className="chips" role="group" aria-label="Filter nach Feed">
          <Link href="/articles?feed=all" aria-current={!active ? "true" : undefined}>Alle abonnierten</Link>
          {feeds.map((f) => (
            <Link key={f.id} href={`/articles?feed=${f.id}`} aria-current={active?.id === f.id ? "true" : undefined}>{f.icon} {f.name}</Link>
          ))}
        </div>
      )}
      {errors.map((e) => (
        <p key={e.feedId} role="alert" className="error">{e.feedName}: {e.error}</p>
      ))}
      {feeds.length > 0 && items.length === 0 && errors.length === 0 && <p className="muted">Keine Artikel. Abonniere einen Feed unter „Feeds“.</p>}
      <ul className={`items ${settings.view}`}>
        {items.map((item) => {
          const href = safeHref(item.link);
          return (
            <li key={item.id} className="card">
              <div className="meta">{icons.get(item.feedId)} {item.feedName} · {formatDate(item.publishedAt)}</div>
              <h2>{href ? <Link href={`/articles/view?url=${encodeURIComponent(href)}`}>{item.title}</Link> : item.title}</h2>
              <p>{item.description.slice(0, 240)}{item.description.length > 240 ? " …" : ""}</p>
              <SummaryButton url={item.link || item.id} title={item.title} text={item.description} />
              {href && <a className="muted" href={href} target="_blank" rel="noopener noreferrer">Original öffnen</a>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
