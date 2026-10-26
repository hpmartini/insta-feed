'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ArticleListItem, ClustersResult, Feed } from '@instafeed/shared';
import { api, errMsg } from '@/lib/api';
import { useSettings } from '@/components/Shell';

function Item({ a }: { a: ArticleListItem }) {
  const href = `/article?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`;
  return (
    <li className="card">
      <Link href={href}><strong>{a.title}</strong></Link>
      <small>{a.feedName} · {new Date(a.isoDate).toLocaleString('de-DE')}</small>
      <p>{a.snippet}</p>
    </li>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [feedId, setFeedId] = useState(settings.defaultFeed);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [clusters, setClusters] = useState<ClustersResult>();
  const [group, setGroup] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => { api.feeds().then((f) => setFeeds(f.filter((x) => x.subscribed))).catch((e) => setError(errMsg(e))); }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      if (group) setClusters(await api.clusters(feedId || undefined));
      else setArticles((await api.articles(feedId || undefined)).sort((a, b) => b.isoDate.localeCompare(a.isoDate)));
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }, [feedId, group]);

  useEffect(() => { setBusy(true); load(); }, [load]);
  useEffect(() => {
    if (!settings.refreshMinutes) return;
    const t = setInterval(load, settings.refreshMinutes * 60_000);
    return () => clearInterval(t);
  }, [load, settings.refreshMinutes]);

  return (
    <>
      <div className="bar">
        <h1>Artikel</h1>
        <select value={feedId} onChange={(e) => setFeedId(e.target.value)}>
          <option value="">Alle Feeds</option>
          {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label><input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} /> Storys gruppieren</label>
      </div>
      {error && <p className="error">{error}</p>}
      {busy ? <p>Lade …</p> : group ? (
        <>
          {clusters && <small>Anbieter: <span className="badge">{clusters.provider}</span></small>}
          {clusters?.clusters.map((c, i) => (
            <section className="card" key={i}>
              <h2>{c.title}</h2>
              <p>{c.summary}</p>
              <ul className="articles list">{c.articles.map((a) => <Item key={a.guid + a.feedId} a={a} />)}</ul>
            </section>
          ))}
          {clusters?.clusters.length === 0 && <p>Keine Storys.</p>}
        </>
      ) : (
        <ul className={`articles ${settings.view}`}>
          {articles.map((a) => <Item key={a.guid + a.feedId} a={a} />)}
          {articles.length === 0 && <p>Keine Artikel. Abonniere Feeds unter „Feeds“.</p>}
        </ul>
      )}
    </>
  );
}
