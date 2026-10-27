import type { Database } from "bun:sqlite";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  view: "list",
  refreshMinutes: 0,
  speed: 30,
  defaultFeedId: null,
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Coerces untrusted input (form data, stored JSON) into valid settings. */
export function sanitizeSettings(raw: Partial<Record<keyof Settings, unknown>>): Settings {
  const d = DEFAULT_SETTINGS;
  const feedId = Number(raw.defaultFeedId);
  return {
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "system",
    view: raw.view === "stories" ? "stories" : "list",
    refreshMinutes: clampInt(raw.refreshMinutes, 0, 120, d.refreshMinutes),
    speed: clampInt(raw.speed, 1, 100, d.speed),
    defaultFeedId: raw.defaultFeedId != null && raw.defaultFeedId !== "" && Number.isInteger(feedId) ? feedId : null,
  };
}

export function getSettings(db: Database, userId: string): Settings {
  const row = db.query<{ json: string }, [string]>("SELECT json FROM settings WHERE user_id = ?").get(userId);
  return row ? sanitizeSettings(JSON.parse(row.json)) : DEFAULT_SETTINGS;
}

export function saveSettings(db: Database, userId: string, raw: Partial<Record<keyof Settings, unknown>>): Settings {
  const settings = sanitizeSettings(raw);
  db.query("INSERT INTO settings (user_id, json) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET json = excluded.json").run(
    userId,
    JSON.stringify(settings),
  );
  return settings;
}
