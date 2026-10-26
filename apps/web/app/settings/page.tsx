'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Feed, Settings } from '@instafeed/shared';
import { api, errMsg } from '@/lib/api';
import { useSettings } from '@/components/Shell';

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState<Settings>(settings);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => { api.feeds().then(setFeeds).catch((e) => setMsg(errMsg(e))); }, []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    try { setSettings(await api.saveSettings(form)); setMsg('Gespeichert.'); } catch (err) { setMsg(errMsg(err)); }
  }

  return (
    <form className="card auth" onSubmit={save}>
      <h1>Einstellungen</h1>
      <label>Theme
        <select value={form.theme} onChange={(e) => set('theme', e.target.value as Settings['theme'])}>
          <option value="light">Hell</option><option value="dark">Dunkel</option>
        </select>
      </label>
      <label>Ansicht
        <select value={form.view} onChange={(e) => set('view', e.target.value as Settings['view'])}>
          <option value="list">Liste</option><option value="grid">Raster</option>
        </select>
      </label>
      <label>Row-Runner-Tempo (Zeichen pro Sekunde)
        <input type="number" min={1} max={500} value={form.speed} onChange={(e) => set('speed', Number(e.target.value))} />
      </label>
      <label>Standard-Feed
        <select value={form.defaultFeed} onChange={(e) => set('defaultFeed', e.target.value)}>
          <option value="">Alle Feeds</option>
          {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label>Aktualisierung (Minuten, 0 = aus)
        <input type="number" min={0} value={form.refreshMinutes} onChange={(e) => set('refreshMinutes', Number(e.target.value))} />
      </label>
      <button className="primary">Speichern</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}
