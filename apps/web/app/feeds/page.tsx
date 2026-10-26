'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Feed, FeedInput } from '@instafeed/shared';
import { api, errMsg } from '@/lib/api';

function FeedForm({ initial, label, onSubmit, onCancel }: {
  initial?: FeedInput; label: string; onSubmit: (v: FeedInput) => Promise<void>; onCancel?: () => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await onSubmit({ name: String(f.get('name')), url: String(f.get('url')), icon: String(f.get('icon')) || undefined });
    if (!initial) form.reset();
  }
  return (
    <form className="bar" onSubmit={submit}>
      <input name="name" placeholder="Name" defaultValue={initial?.name} required />
      <input name="url" type="url" placeholder="Feed-URL" defaultValue={initial?.url} required />
      <input name="icon" placeholder="Icon (optional)" defaultValue={initial?.icon} />
      <button className="primary">{label}</button>
      {onCancel && <button type="button" onClick={onCancel}>Abbrechen</button>}
    </form>
  );
}

export default function Feeds() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.feeds().then(setFeeds).catch((e) => setError(errMsg(e))); }, []);

  const replace = (f: Feed) => setFeeds((l) => l.map((x) => (x.id === f.id ? f : x)));
  const run = async (fn: () => Promise<void>) => { try { setError(''); await fn(); } catch (e) { setError(errMsg(e)); } };

  return (
    <>
      <h1>Feeds</h1>
      {error && <p className="error">{error}</p>}
      <h2>Feed hinzufügen</h2>
      <FeedForm label="Hinzufügen" onSubmit={(v) => run(async () => { const f = await api.addFeed(v); setFeeds((l) => [...l, f]); })} />
      <ul className="articles list">
        {feeds.map((f) => (
          <li className="card" key={f.id}>
            {editing === f.id ? (
              <FeedForm initial={f} label="Speichern" onCancel={() => setEditing('')}
                onSubmit={(v) => run(async () => { replace(await api.updateFeed(f.id, v)); setEditing(''); })} />
            ) : (
              <div className="bar">
                <span>{f.icon} <strong>{f.name}</strong> <small>{f.url}</small></span>
                <label><input type="checkbox" checked={f.subscribed}
                  onChange={(e) => run(async () => replace(await api.updateFeed(f.id, { subscribed: e.target.checked })))} /> Abonniert</label>
                <button onClick={() => setEditing(f.id)}>Bearbeiten</button>
                <button onClick={() => run(async () => { await api.deleteFeed(f.id); setFeeds((l) => l.filter((x) => x.id !== f.id)); })}>Löschen</button>
              </div>
            )}
          </li>
        ))}
        {feeds.length === 0 && <p>Noch keine Feeds.</p>}
      </ul>
    </>
  );
}
