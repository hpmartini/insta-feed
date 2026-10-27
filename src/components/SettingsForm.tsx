"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/actions";
import type { Feed, Settings } from "@/lib/types";

export default function SettingsForm({ settings, feeds }: { settings: Settings; feeds: Feed[] }) {
  const [state, action, pending] = useActionState(saveSettingsAction, {});

  return (
    <form action={action} className="card stack" style={{ maxWidth: 480 }}>
      <label>
        Theme
        <select name="theme" defaultValue={settings.theme}>
          <option value="system">System</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
      <label>
        Standard-Ansicht der Artikel
        <select name="view" defaultValue={settings.view}>
          <option value="list">Liste</option>
          <option value="stories">Stories (KI-Cluster)</option>
        </select>
      </label>
      <label>
        Standard-Feed
        <select name="defaultFeedId" defaultValue={settings.defaultFeedId ?? ""}>
          <option value="">Alle Feeds</option>
          {feeds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Automatisch aktualisieren (Minuten, 0 = aus)
        <input name="refreshMinutes" type="number" min={0} max={120} defaultValue={settings.refreshMinutes} />
      </label>
      <label>
        Row-Runner-Geschwindigkeit (Millisekunden pro Buchstabe, 1–100)
        <input name="speed" type="number" min={1} max={100} defaultValue={settings.speed} />
      </label>
      <div className="row">
        <button type="submit" disabled={pending}>
          Speichern
        </button>
        {state.ok && (
          <span className="muted" role="status">
            Gespeichert
          </span>
        )}
      </div>
    </form>
  );
}
