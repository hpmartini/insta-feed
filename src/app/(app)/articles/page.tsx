import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { getAi } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { listFeeds } from "@/lib/feeds";
import { loadFeedItems } from "@/lib/reader";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import type { ArticleView, FeedItem } from "@/lib/types";

type SearchParams = Promise<{ feed?: string; view?: string }>;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "";

const readHref = (item: FeedItem) => `/articles/read?url=${encodeURIComponent(item.link)}`;

function query(feed: string, view: ArticleView) {
  return `/articles?feed=${feed}&view=${view}`;
}

export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const db = getDb();
  const settings = getSettings(db, user.id);
  const feeds = listFeeds(db, user.id, { subscribedOnly: true });

  const feedParam = params.feed ?? (settings.defaultFeedId != null ? String(settings.defaultFeedId) : "all");
  const selected = feeds.find((f) => String(f.id) === feedParam);
  const feedKey = selected ? String(selected.id) : "all";
  const view: ArticleView = params.view === "stories" || params.view === "list" ? params.view : settings.view;

  if (feeds.length === 0) {
    return (
      <>
        <h1>Artikel</h1>
        <p className="muted">
          Du hast noch keine Feeds abonniert. <Link href="/feeds">Feeds verwalten</Link>
        </p>
      </>
    );
  }

  const { items, errors } = await loadFeedItems(selected ? [selected] : feeds);
  const ai = getAi();
  const stories = view === "stories" ? await ai.clusterStories(items) : [];

  return (
    <>
      <AutoRefresh minutes={settings.refreshMinutes} />
      <h1>Artikel</h1>

      <nav className="filters" aria-label="Feed-Filter">
        <Link className="chip" href={query("all", view)} aria-current={feedKey === "all" ? "page" : undefined}>
          Alle
        </Link>
        {feeds.map((f) => (
          <Link
            key={f.id}
            className="chip"
            href={query(String(f.id), view)}
            aria-current={feedKey === String(f.id) ? "page" : undefined}
          >
            <span aria-hidden="true">{f.icon}</span> {f.name}
          </Link>
        ))}
      </nav>

      <nav className="filters" aria-label="Ansicht">
        <Link className="chip" href={query(feedKey, "list")} aria-current={view === "list" ? "page" : undefined}>
          Liste
        </Link>
        <Link className="chip" href={query(feedKey, "stories")} aria-current={view === "stories" ? "page" : undefined}>
          Stories (KI-Cluster)
        </Link>
      </nav>

      {errors.map(({ feed, message }) => (
        <p key={feed.id} className="error" role="alert">
          {feed.name}: {message}
        </p>
      ))}

      {items.length === 0 && errors.length === 0 && <p className="muted">Keine Artikel gefunden.</p>}

      {view === "list" &&
        items.map((item) => (
          <article key={`${item.feedId}-${item.guid}`} className="card">
            <Link href={readHref(item)} className="item-title">
              {item.title}
            </Link>
            <div className="muted">
              {item.feedName} · {formatDate(item.publishedAt)}
            </div>
            {item.snippet && <p style={{ marginBottom: 0 }}>{item.snippet}</p>}
          </article>
        ))}

      {view === "stories" && (
        <>
          <p className="muted">Gruppiert mit KI-Adapter „{ai.name}“.</p>
          {stories.map((story) => (
            <article key={story.id} className="card">
              <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.25rem" }}>{story.title}</h2>
              <div className="muted">
                {story.items.length} {story.items.length === 1 ? "Artikel" : "Artikel aus mehreren Quellen"}
              </div>
              {story.summary && <p>{story.summary}</p>}
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {story.items.map((item) => (
                  <li key={`${item.feedId}-${item.guid}`}>
                    <Link href={readHref(item)}>{item.title}</Link>{" "}
                    <span className="muted">({item.feedName})</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}
    </>
  );
}
