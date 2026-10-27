"use client";

import { SettingsSchema, type Settings } from "@insta-feed/shared";
import { useState, type FormEvent } from "react";
import { api, useSession } from "../../../lib/session";
import { useLoad } from "../../../lib/use-load";

export default function SettingsPage() {
  const { settings, setSettings, fail } = useSession();
  const feeds = useLoad(() => api.listFeeds(), []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Kontrolliert: Optionen erscheinen erst nach dem Feed-Laden, defaultValue würde die gespeicherte ID verlieren.
  const [defaultFeed, setDefaultFeed] = useState(settings.default_feed_id ?? "");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = SettingsSchema.safeParse({
      theme: f.get("theme"),
      view: f.get("view"),
      refresh_minutes: f.get("refresh_minutes") === "" ? NaN : Number(f.get("refresh_minutes")),
      speed: f.get("speed") === "" ? NaN : Number(f.get("speed")),
      default_feed_id: f.get("default_feed_id") || null,
    });
    if (!parsed.success) return setMsg({ ok: false, text: "Ungültige Eingabe: Intervall 0–1440 (ganzzahlig), Tempo 1–100." });
    setBusy(true);
    setMsg(null);
    try {
      setSettings(await api.putSettings(parsed.data as Settings));
      setMsg({ ok: true, text: "Gespeichert." });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setBusy(false);
    }
  }

  const feedList = feeds.state.status === "ready" ? feeds.state.data : [];
  return (
    <section>
      <h1>Einstellungen</h1>
      <form onSubmit={save} className="stack" aria-busy={busy}>
        <label>Theme
          <select name="theme" defaultValue={settings.theme}>
            <option value="system">System</option><option value="light">Hell</option><option value="dark">Dunkel</option>
          </select>
        </label>
        <label>Ansicht
          <select name="view" defaultValue={settings.view}><option value="list">Liste</option><option value="cards">Karten</option></select>
        </label>
        <label>Aktualisierungsintervall (Minuten, 0 = aus)
          <input name="refresh_minutes" type="number" min={0} max={1440} step={1} required defaultValue={settings.refresh_minutes} />
        </label>
        <label>Ticker-Tempo (ms pro Zeichen, 1–100)
          <input name="speed" type="number" min={1} max={100} step="any" required defaultValue={settings.speed} />
        </label>
        <small className="muted">Der Ticker ist noch nicht portiert; das Tempo wird nur gespeichert.</small>
        <label>Standardfeed
          <select name="default_feed_id" value={defaultFeed} onChange={(e) => setDefaultFeed(e.target.value)} disabled={feeds.state.status !== "ready"}>
            <option value="">Alle abonnierten</option>
            {feedList.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        </label>
        {feeds.state.status === "error" && <p role="alert" className="error">Feeds: {feeds.state.message} <button type="button" onClick={feeds.reload}>Erneut</button></p>}
        <button type="submit" disabled={busy || feeds.state.status !== "ready"}>Speichern</button>
        <div role="status">{msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}</div>
      </form>
    </section>
  );
}
