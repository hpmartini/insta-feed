"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Feed, Settings } from "@instafeed/shared";
import { api } from "@/lib/client";

export default function SettingsForm({ settings, feeds }: { settings: Settings; feeds: Feed[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("PUT", "/api/settings", {
        theme: f.get("theme"),
        view: f.get("view"),
        refreshMinutes: Number(f.get("refreshMinutes")),
        speed: Number(f.get("speed")),
        defaultFeedId: f.get("defaultFeedId") ? Number(f.get("defaultFeedId")) : null,
      });
      setMsg({ ok: true, text: "Gespeichert" });
      router.refresh(); // root layout re-reads the theme
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Fehler" });
    }
  }

  return (
    <form onSubmit={save} className="card stack">
      <label>
        Theme
        <select name="theme" defaultValue={settings.theme}>
          <option value="system">System</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
      <label>
        Ansicht der Artikel
        <select name="view" defaultValue={settings.view}>
          <option value="list">Liste</option>
          <option value="cards">Karten</option>
        </select>
      </label>
      <label>
        Aktualisierung (Minuten, 0 = aus)
        <input name="refreshMinutes" type="number" min={0} max={1440} defaultValue={settings.refreshMinutes} />
      </label>
      <label>
        Row-Runner-Geschwindigkeit (1 langsam – 10 schnell)
        <input name="speed" type="range" min={1} max={10} defaultValue={settings.speed} />
      </label>
      <label>
        Standard-Feed
        <select name="defaultFeedId" defaultValue={settings.defaultFeedId ?? ""}>
          <option value="">Alle abonnierten</option>
          {feeds.map((f) => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
      </label>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
      <button className="primary">Speichern</button>
    </form>
  );
}
