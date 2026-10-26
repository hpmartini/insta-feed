'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { ArticleDetail, Summary } from '@instafeed/shared';
import { api, errMsg } from '@/lib/api';

function Article() {
  const p = useSearchParams();
  const url = p.get('url') ?? '';
  const title = p.get('title') ?? '';
  const [art, setArt] = useState<ArticleDetail>();
  const [sum, setSum] = useState<Summary>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (url) api.article(url).then(setArt).catch((e) => setError(errMsg(e))); }, [url]);

  async function summarize() {
    if (!art) return;
    setBusy(true);
    try { setSum(await api.summary(url, art.title || title, art.content)); } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  }

  if (!url) return <p className="error">Kein Artikel angegeben.</p>;
  return (
    <article>
      <h1>{art?.title || title}</h1>
      {error && <p className="error">{error}</p>}
      {!art && !error && <p>Lade …</p>}
      {art && (
        <>
          <small>{art.siteName}</small>
          {art.excerpt && <p><em>{art.excerpt}</em></p>}
          <div className="bar">
            <button className="primary" onClick={summarize} disabled={busy}>{busy ? 'Fasse zusammen …' : 'Zusammenfassen'}</button>
            <a href={url} target="_blank" rel="noreferrer">Original öffnen</a>
            <Link href={`/runner?url=${encodeURIComponent(url)}`}>Im Row Runner</Link>
          </div>
          {sum && <div className="card"><span className="badge">{sum.provider}</span><p>{sum.summary}</p></div>}
          <div className="text">{art.content}</div>
        </>
      )}
    </article>
  );
}

export default function Page() {
  return <Suspense><Article /></Suspense>;
}
