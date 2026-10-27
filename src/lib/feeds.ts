import type { Database } from "bun:sqlite";
import { assertHttpUrl } from "./net";
import type { Feed, FeedInput } from "./types";

const DEFAULT_ICON = "📰";

interface FeedRow {
  id: number;
  user_id: string;
  name: string;
  url: string;
  icon: string;
  subscribed: number;
  created_at: string;
}

const toFeed = (r: FeedRow): Feed => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  url: r.url,
  icon: r.icon,
  subscribed: r.subscribed === 1,
  createdAt: r.created_at,
});

/** Validates user input at the trust boundary; returns clean values. */
export function validateFeedInput(input: FeedInput): Required<FeedInput> {
  const name = input.name.trim();
  const url = input.url.trim();
  if (!name) throw new Error("Name fehlt");
  return { name: name.slice(0, 100), url: assertHttpUrl(url).toString(), icon: input.icon?.trim().slice(0, 8) || DEFAULT_ICON };
}

export function listFeeds(db: Database, userId: string, opts: { subscribedOnly?: boolean } = {}): Feed[] {
  const sql = `SELECT * FROM feeds WHERE user_id = ?${opts.subscribedOnly ? " AND subscribed = 1" : ""} ORDER BY name COLLATE NOCASE`;
  return db.query<FeedRow, [string]>(sql).all(userId).map(toFeed);
}

export function getFeed(db: Database, userId: string, id: number): Feed | null {
  const row = db.query<FeedRow, [number, string]>("SELECT * FROM feeds WHERE id = ? AND user_id = ?").get(id, userId);
  return row ? toFeed(row) : null;
}

/** Adds a feed; adding an existing URL again updates it and re-subscribes (like the old setFeed). */
export function addFeed(db: Database, userId: string, input: FeedInput): Feed {
  const { name, url, icon } = validateFeedInput(input);
  const row = db
    .query<FeedRow, [string, string, string, string]>(
      `INSERT INTO feeds (user_id, name, url, icon) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, url) DO UPDATE SET name = excluded.name, icon = excluded.icon, subscribed = 1
       RETURNING *`,
    )
    .get(userId, name, url, icon);
  return toFeed(row!);
}

export function updateFeed(db: Database, userId: string, id: number, input: FeedInput): Feed {
  const { name, url, icon } = validateFeedInput(input);
  try {
    const row = db
      .query<FeedRow, [string, string, string, number, string]>(
        "UPDATE feeds SET name = ?, url = ?, icon = ? WHERE id = ? AND user_id = ? RETURNING *",
      )
      .get(name, url, icon, id, userId);
    if (!row) throw new Error("Feed nicht gefunden");
    return toFeed(row);
  } catch (e) {
    if (e instanceof Error && e.message.includes("UNIQUE")) throw new Error("Diese URL ist bereits als Feed angelegt");
    throw e;
  }
}

export function setSubscribed(db: Database, userId: string, id: number, subscribed: boolean): void {
  const { changes } = db.query("UPDATE feeds SET subscribed = ? WHERE id = ? AND user_id = ?").run(subscribed ? 1 : 0, id, userId);
  if (!changes) throw new Error("Feed nicht gefunden");
}

export function deleteFeed(db: Database, userId: string, id: number): void {
  db.query("DELETE FROM feeds WHERE id = ? AND user_id = ?").run(id, userId);
}
