"use client";

import type { Feed } from "@insta-feed/shared";
import { ApiError } from "@insta-feed/api-client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Async } from "../../components/states";
import { api, errMsg, useSession } from "../../lib/session";
import { useLoad } from "../../lib/use-load";

export default function Articles() {
  const { settings } = useSession();
  const feeds = useLoad(() => api.listFeeds(), []);
  const [feedId, setFeedId] = useState(settings.default_feed_id ?? "");
  const articles = useLoad(() => api.listArticles(feedId ? { feedId } : {}), [feedId]);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<{ ok: number; imported: number; errors: string[] } | null>(null);
  const busy = useRef(false);

  const feedList = feeds.state.status === "ready" ? feeds.state.data : [];
  // Gespeicherter Standardfeed, der nicht mehr existiert, fällt auf "Alle" zurück.
  const selected = feedId && feedList.some((f) => f.id === feedId) ? feedId : feeds.state.status === "ready" ? "" : feedId;
  const targetsRef = useRef<Feed[]>([]);
  targetsRef.current = selected ? feedList.filter((f) => f.id === selected) : feedList.filter((f) => f.subscribed);
  const reloadAll = useRef({ a: articles.reload, f: feeds.reload });
  reloadAll.current = { a: articles.reload, f: feeds.reload };

  const refresh = useCallback(async () => {
    if (busy.current) return; // keine Überschneidung (Button + Intervall)
    busy.current = true;
    setRefreshing(true);
    const results = await Promise.allSettled(targetsRef.current.map((f) => api.refreshFeed(f.id)));
    const errors = results.flatMap((r, i) =>
      r.status === "rejected" ? [`${targetsRef.current[i].title}: ${r.reason instanceof ApiError && r.reason.refresh?.feed.lastError ? r.reason.refresh.feed.lastError : errMsg(r.reason)}`] : [],
    );
    setReport({
      ok: results.length - errors.length,
      imported: results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.imported : 0), 0),
      errors,
    });
    busy.current = false;
    setRefreshing(false);
    reloadAll.current.a();
    reloadAll.current.f();
  }, []);

  useEffect(() => {
    if (settings.refresh_minutes <= 0) return;
    const t = setInterval(refresh, settings.refresh_minutes * 60_000);
    return () => clearInterval(t);
  }, [settings.refresh_minutes, refresh]);

  const subscribedIds = new Set(feedList.filter((f) => f.subscribed).map((f) => f.id));
  const titleOf = new Map(feedList.map((f) => [f.id, f.title]));

  return (
    <section>
      <h1>Artikel</h1>
      <div className="toolbar">
        <label>
          Feed
          <select value={selected} onChange={(e) => { setFeedId(e.target.value); setReport(null); }} disabled={feeds.state.status !== "ready"}>
            <option value="">Alle abonnierten</option>
            {feedList.map((f) => <option key={f.id} value={f.id}>{f.title}{f.subscribed ? "" : " (abbestellt)"}</option>)}
          </select>
        </label>
        <button onClick={refresh} disabled={refreshing || feeds.state.status !== "ready"}>{refreshing ? "Aktualisiere …" : "Aktualisieren"}</button>
      </div>
      {feeds.state.status === "error" && <p role="alert" className="error">Feeds: {feeds.state.message} <button onClick={feeds.reload}>Erneut</button></p>}
      <div role="status">
        {report && (
          <p className={report.errors.length ? "warn" : "ok"}>
            {report.ok} Feed(s) aktualisiert, {report.imported} neue Artikel{report.errors.length ? `, ${report.errors.length} Fehler` : ""}.
          </p>
        )}
      </div>
      {report?.errors.length ? <ul className="error">{report.errors.map((m) => <li key={m}>{m}</li>)}</ul> : null}
      <Async state={articles.state} retry={articles.reload} empty="Keine Artikel. Feed anlegen oder aktualisieren.">
        {(list) => {
          const shown = selected || feeds.state.status !== "ready" ? list : list.filter((a) => subscribedIds.has(a.feedId));
          if (shown.length === 0) return <p className="muted">Keine Artikel in abonnierten Feeds.</p>;
          return (
            <ul className={`articles ${settings.view}`}>
              {shown.map((a) => (
                <li key={a.id}>
                  <Link href={`/articles/${encodeURIComponent(a.id)}`}>{a.title}</Link>
                  <small className="muted">
                    {titleOf.get(a.feedId) ?? "?"}{a.publishedAt ? ` · ${new Date(a.publishedAt).toLocaleString("de-DE")}` : ""}
                  </small>
                  {settings.view === "cards" && <p>{a.content.slice(0, 200)}</p>}
                </li>
              ))}
            </ul>
          );
        }}
      </Async>
    </section>
  );
}
