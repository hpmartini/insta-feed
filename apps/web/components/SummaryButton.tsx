"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export default function SummaryButton({ url, title, text }: { url: string; title: string; text: string }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    try {
      setSummary((await api<{ summary: string }>("POST", "/api/ai/summary", { url, title, content: text })).summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
    setBusy(false);
  }

  return (
    <div className="summary">
      {!summary && <button onClick={run} disabled={busy}>{busy ? "Fasse zusammen …" : "KI-Zusammenfassung"}</button>}
      {summary && <p className="summary-text"><strong>Zusammenfassung:</strong> {summary}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}
