"use client";

import Link from "next/link";
import { Async } from "../../../components/states";
import { api } from "../../../lib/session";
import { useLoad } from "../../../lib/use-load";

export default function Stories() {
  const { state, reload } = useLoad(() => api.listStories(), []);
  return (
    <section>
      <h1>Stories</h1>
      <p className="muted">Gruppiert ähnliche Titel der letzten 48 h mit einer lokalen Heuristik (Jaccard), kein KI-Aufruf.</p>
      <Async state={state} retry={reload} empty="Keine Stories: keine ähnlichen Artikel in den letzten 48 Stunden.">
        {(list) => (
          <ul className="stories">
            {list.map((c) => (
              <li key={c.id}>
                <h2>{c.title}</h2>
                <small className="muted">{c.provider === "mock" ? "Lokale Heuristik" : c.provider} · {c.model} · {c.articleIds.length} Artikel</small>
                <ul>{c.articleIds.map((id, i) => <li key={id}><Link href={`/articles/${encodeURIComponent(id)}`}>Artikel {i + 1}</Link></li>)}</ul>
                <ul>{c.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </section>
  );
}
