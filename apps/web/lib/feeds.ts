import type { Feed } from "@instafeed/shared";
import { getDb } from "./db";
import { HttpError } from "./errors";

// Every query is scoped by user_id: a feed id from another user behaves like a missing one.
type Row = { id: number; name: string; url: string; icon: string; subscribed: number };
const toFeed = (r: Row): Feed => ({ ...r, subscribed: !!r.subscribed });
const COLS = "id, name, url, icon, subscribed";

export function listFeeds(userId: number): Feed[] {
  return (getDb().query(`SELECT ${COLS} FROM feeds WHERE user_id = ? ORDER BY name COLLATE NOCASE`).all(userId) as Row[]).map(toFeed);
}

export function getFeed(userId: number, id: number): Feed {
  const row = getDb().query(`SELECT ${COLS} FROM feeds WHERE id = ? AND user_id = ?`).get(id, userId) as Row | null;
  if (!row) throw new HttpError(404, "Feed nicht gefunden");
  return toFeed(row);
}

function text(v: unknown, field: string, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s.length > max) throw new HttpError(400, `${field}: 1 bis ${max} Zeichen erforderlich`);
  return s;
}

function feedUrl(v: unknown): string {
  const s = text(v, "URL", 2000);
  try {
    if (/^https?:$/.test(new URL(s).protocol)) return s;
  } catch {}
  throw new HttpError(400, "URL muss mit http:// oder https:// beginnen");
}

function uniqueUrl<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new HttpError(409, "Feed-URL existiert bereits");
    throw e;
  }
}

export function createFeed(userId: number, input: Record<string, unknown>): Feed {
  const name = text(input.name, "Name", 100);
  const url = feedUrl(input.url);
  const icon = input.icon ? text(input.icon, "Icon", 16) : "📰";
  const row = uniqueUrl(
    () =>
      getDb()
        .query(`INSERT INTO feeds (user_id, name, url, icon, subscribed, created_at) VALUES (?, ?, ?, ?, 1, ?) RETURNING ${COLS}`)
        .get(userId, name, url, icon, Date.now()) as Row,
  );
  return toFeed(row);
}

/** Partial update: only name, url, icon and subscribed are accepted. */
export function updateFeed(userId: number, id: number, patch: Record<string, unknown>): Feed {
  const cur = getFeed(userId, id);
  const next = {
    name: "name" in patch ? text(patch.name, "Name", 100) : cur.name,
    url: "url" in patch ? feedUrl(patch.url) : cur.url,
    icon: "icon" in patch ? text(patch.icon, "Icon", 16) : cur.icon,
    subscribed: "subscribed" in patch ? patch.subscribed : cur.subscribed,
  };
  if (typeof next.subscribed !== "boolean") throw new HttpError(400, "subscribed muss boolean sein");
  uniqueUrl(() =>
    getDb()
      .query("UPDATE feeds SET name = ?, url = ?, icon = ?, subscribed = ? WHERE id = ? AND user_id = ?")
      .run(next.name, next.url, next.icon, next.subscribed ? 1 : 0, id, userId),
  );
  return getFeed(userId, id);
}

export function deleteFeed(userId: number, id: number): void {
  if (getDb().query("DELETE FROM feeds WHERE id = ? AND user_id = ?").run(id, userId).changes === 0) {
    throw new HttpError(404, "Feed nicht gefunden");
  }
}
