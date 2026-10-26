import type { Database } from 'bun:sqlite';
import { DEFAULT_SETTINGS, type Settings } from '@instafeed/shared';

export function getSettings(db: Database, userId: string): Settings {
  const row = db.query('SELECT json FROM settings WHERE user_id = ?').get(userId) as { json: string } | null;
  return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.json) : {}) };
}

/** Merges only known keys with the right type, so clients cannot store arbitrary data. */
export function saveSettings(db: Database, userId: string, patch: Partial<Settings>): Settings {
  const next = getSettings(db, userId);
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = patch[key];
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[key]) (next as unknown as Record<string, unknown>)[key] = v;
  }
  if (!['light', 'dark'].includes(next.theme)) next.theme = DEFAULT_SETTINGS.theme;
  if (!['list', 'grid'].includes(next.view)) next.view = DEFAULT_SETTINGS.view;
  db.query('INSERT INTO settings (user_id, json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json')
    .run(userId, JSON.stringify(next));
  return next;
}
