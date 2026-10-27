"use client";

import type { Feed } from "@insta-feed/shared";
import { ApiError } from "@insta-feed/api-client";
import { useState, type FormEvent } from "react";
import { Async } from "../../../components/states";
import { api, useSession } from "../../../lib/session";
import { useLoad } from "../../../lib/use-load";

export default function Feeds() {
  const { fail } = useSession();
  const { state, reload } = useLoad(() => api.listFeeds(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await api.createFeed({ url: String(f.get("url")).trim(), title: String(f.get("title")).trim() });
      form.reset();
      reload();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "Feed-URL existiert bereits." : fail(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Feeds</h1>
      <form onSubmit={create} className="toolbar" aria-busy={busy}>
        <label>URL<input name="url" type="url" required placeholder="https://example.org/feed.xml" /></label>
        <label>Titel<input name="title" required /></label>
        <button type="submit" disabled={busy}>Anlegen</button>
      </form>
      <div role="status">{error && <p className="error">{error}</p>}</div>
      <Async state={state} retry={reload} empty="Noch keine Feeds.">
        {(list) => <ul className="feeds">{list.map((f) => <FeedRow key={f.id} feed={f} onChanged={reload} />)}</ul>}
      </Async>
    </section>
  );
}

function FeedRow({ feed, onChanged }: { feed: Feed; onChanged: () => void }) {
  const { fail } = useSession();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function act(fn: () => Promise<string | void>) {
    setBusy(true);
    setNote(null);
    try {
      const text = await fn();
      if (text) setNote({ ok: true, text });
      setEditing(false);
    } catch (err) {
      const text = err instanceof ApiError && err.status === 409 ? "Konflikt: URL existiert bereits." : err instanceof ApiError && err.refresh ? (err.refresh.feed.lastError ?? err.message) : fail(err);
      setNote({ ok: false, text });
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act(async () => {
      await api.updateFeed(feed.id, { url: String(f.get("url")).trim(), title: String(f.get("title")).trim() });
    });
  }

  return (
    <li aria-busy={busy}>
      {editing ? (
        <form onSubmit={save} className="toolbar">
          <label>Titel<input name="title" required defaultValue={feed.title} /></label>
          <label>URL<input name="url" type="url" required defaultValue={feed.url} /></label>
          <button type="submit" disabled={busy}>Speichern</button>
          <button type="button" onClick={() => setEditing(false)}>Abbrechen</button>
        </form>
      ) : (
        <>
          <strong>{feed.title}</strong> <small className="muted">{feed.url}</small> {!feed.subscribed && <em>(abbestellt)</em>}
          {feed.lastError && <p className="error">Letzter Abruf fehlgeschlagen: {feed.lastError}</p>}
          <div className="toolbar">
            <button disabled={busy} onClick={() => act(async () => { const r = await api.refreshFeed(feed.id); return `${r.imported} neue Artikel.`; })}>Aktualisieren</button>
            <button disabled={busy} onClick={() => act(async () => { await api.setSubscribed(feed.id, !feed.subscribed); })}>{feed.subscribed ? "Abbestellen" : "Abonnieren"}</button>
            <button disabled={busy} onClick={() => setEditing(true)}>Bearbeiten</button>
            <button disabled={busy} onClick={() => { if (confirm(`Feed „${feed.title}“ samt Artikeln löschen?`)) void act(async () => { await api.deleteFeed(feed.id); }); }}>Löschen</button>
          </div>
        </>
      )}
      <div role="status">{note && <p className={note.ok ? "ok" : "error"}>{note.text}</p>}</div>
    </li>
  );
}
