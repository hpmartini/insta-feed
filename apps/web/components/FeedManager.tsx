"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Feed } from "@instafeed/shared";
import { api } from "@/lib/client";

export default function FeedManager({ feeds }: { feeds: Feed[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Feed | null>(null);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      setEditing(null);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      return false;
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = { name: f.get("name"), url: f.get("url"), ...(f.get("icon") ? { icon: f.get("icon") } : {}) };
    if (await run(() => (editing ? api("PATCH", `/api/feeds/${editing.id}`, body) : api("POST", "/api/feeds", body)))) form.reset();
  }

  return (
    <>
      <form key={editing?.id ?? "new"} onSubmit={save} className="card stack">
        <h2>{editing ? "Feed bearbeiten" : "Feed hinzufügen"}</h2>
        <label>Name <input name="name" required maxLength={100} defaultValue={editing?.name} /></label>
        <label>Feed-URL <input name="url" type="url" required defaultValue={editing?.url} placeholder="https://example.com/rss.xml" /></label>
        <label>Icon (Emoji oder Kürzel) <input name="icon" maxLength={16} defaultValue={editing?.icon} placeholder="📰" /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row">
          <button className="primary">{editing ? "Speichern" : "Hinzufügen"}</button>
          {editing && <button type="button" onClick={() => setEditing(null)}>Abbrechen</button>}
        </div>
      </form>

      {feeds.length === 0 && <p className="muted">Noch keine Feeds.</p>}
      <ul className="items list">
        {feeds.map((f) => (
          <li key={f.id} className="card row">
            <span>{f.icon}</span>
            <div className="grow">
              <strong>{f.name}</strong>
              <div className="muted">{f.url}</div>
            </div>
            <button onClick={() => run(() => api("PATCH", `/api/feeds/${f.id}`, { subscribed: !f.subscribed }))} aria-pressed={f.subscribed}>
              {f.subscribed ? "Abbestellen" : "Abonnieren"}
            </button>
            <button onClick={() => setEditing(f)}>Bearbeiten</button>
            <button onClick={() => confirm(`„${f.name}“ löschen?`) && run(() => api("DELETE", `/api/feeds/${f.id}`))}>Löschen</button>
          </li>
        ))}
      </ul>
    </>
  );
}
