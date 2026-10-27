import { THEMES, VIEWS, type Settings } from "@instafeed/shared";
import { getDb } from "./db";
import { HttpError } from "./errors";

export const DEFAULT_SETTINGS: Settings = { theme: "system", view: "list", refreshMinutes: 0, speed: 5, defaultFeedId: null };

type Row = { theme: Settings["theme"]; view: Settings["view"]; refresh_minutes: number; speed: number; default_feed_id: number | null };

export function getSettings(userId: number): Settings {
  const r = getDb().query("SELECT * FROM settings WHERE user_id = ?").get(userId) as Row | null;
  return r
    ? { theme: r.theme, view: r.view, refreshMinutes: r.refresh_minutes, speed: r.speed, defaultFeedId: r.default_feed_id }
    : { ...DEFAULT_SETTINGS };
}

function intIn(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new HttpError(400, `${field}: ganze Zahl ${min} bis ${max}`);
  return v;
}

/** Partial update with a whitelist: unknown keys are ignored, bad values rejected. */
export function saveSettings(userId: number, patch: Record<string, unknown>): Settings {
  const cur = getSettings(userId);
  const next: Settings = { ...cur };
  if ("theme" in patch) {
    if (!THEMES.includes(patch.theme as never)) throw new HttpError(400, "theme ungültig");
    next.theme = patch.theme as Settings["theme"];
  }
  if ("view" in patch) {
    if (!VIEWS.includes(patch.view as never)) throw new HttpError(400, "view ungültig");
    next.view = patch.view as Settings["view"];
  }
  if ("refreshMinutes" in patch) next.refreshMinutes = intIn(patch.refreshMinutes, "refreshMinutes", 0, 1440);
  if ("speed" in patch) next.speed = intIn(patch.speed, "speed", 1, 10);
  if ("defaultFeedId" in patch) {
    const id = patch.defaultFeedId;
    if (id !== null) {
      intIn(id, "defaultFeedId", 1, Number.MAX_SAFE_INTEGER);
      if (!getDb().query("SELECT 1 FROM feeds WHERE id = ? AND user_id = ?").get(id as number, userId)) throw new HttpError(400, "defaultFeedId unbekannt");
    }
    next.defaultFeedId = id as number | null;
  }
  getDb()
    .query(
      `INSERT INTO settings (user_id, theme, view, refresh_minutes, speed, default_feed_id) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme, view = excluded.view, refresh_minutes = excluded.refresh_minutes,
         speed = excluded.speed, default_feed_id = excluded.default_feed_id`,
    )
    .run(userId, next.theme, next.view, next.refreshMinutes, next.speed, next.defaultFeedId);
  return next;
}
