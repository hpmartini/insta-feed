"use client";

import { ApiError } from "@insta-feed/api-client";
import type { Summary } from "@insta-feed/shared";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { api, useSession } from "../../../../lib/session";
import { useLoad } from "../../../../lib/use-load";

const providerLabel = (s: Summary) =>
  s.provider === "mock" ? `Mock (lokal, deterministisch – keine echte KI), ${s.model}` : `${s.provider} · ${s.model}`;

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { fail } = useSession();
  const content = useLoad(() => api.articleContent(id), [id]);
  const [summary, setSummary] = useState<{ status: "idle" | "loading" } | { status: "error"; message: string } | { status: "ready"; data: Summary }>({ status: "idle" });
  const run = useRef(0);

  async function summarize() {
    const mine = ++run.current;
    setSummary({ status: "loading" });
    try {
      const data = await api.summarize(id);
      if (mine === run.current) setSummary({ status: "ready", data });
    } catch (e) {
      if (mine === run.current) setSummary({ status: "error", message: fail(e) });
    }
  }

  if (content.state.status === "error" && content.state.message === "not found") return <p role="alert">Artikel nicht gefunden. <Link href="/">Zur Übersicht</Link></p>;

  return (
    <article>
      <p><Link href="/">← Artikel</Link></p>
      <h1>Artikel</h1>
      {content.state.status === "loading" && <p aria-busy="true" role="status">Lade Volltext …</p>}
      {content.state.status === "error" && (
        <div role="alert" className="error">
          <p>{content.state.message}</p>
          <button onClick={content.reload}>Erneut versuchen</button>
        </div>
      )}
      {content.state.status === "ready" && (
        <>
          <p><a href={content.state.data.url} target="_blank" rel="noopener noreferrer">Originalquelle</a></p>
          {content.state.data.fallback && <p className="warn" role="status">Volltext nicht abrufbar – es wird nur der gespeicherte Auszug angezeigt.</p>}
          {content.state.data.text === "" ? <p className="muted">Kein Text vorhanden.</p> : <div className="fulltext">{content.state.data.text}</div>}
        </>
      )}

      <section aria-labelledby="sum-h">
        <h2 id="sum-h">Zusammenfassung</h2>
        <button onClick={summarize} disabled={summary.status === "loading"}>
          {summary.status === "ready" || summary.status === "error" ? "Erneut zusammenfassen" : "Zusammenfassen"}
        </button>
        <div role="status">{summary.status === "loading" && "Erstelle Zusammenfassung …"}</div>
        {summary.status === "error" && <p role="alert" className="error">{summary.message}</p>}
        {summary.status === "ready" && (
          <>
            <p>{summary.data.text}</p>
            <p className="muted">Erzeugt von: {providerLabel(summary.data)} · Prompt {summary.data.promptVersion}</p>
            <ul>{summary.data.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> <small className="muted">({s.origin === "ai" ? "KI-genannt" : "Feed"})</small></li>)}</ul>
          </>
        )}
      </section>
    </article>
  );
}
