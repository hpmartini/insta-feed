import type { Database } from 'bun:sqlite';
import type { Feed, FeedInput } from '@instafeed/shared';
import { assertPublicUrl, HttpError } from './http';

interface FeedRow { id: string; name: string; url: string; icon: string | null; subscribed: number }
const toFeed = (r: FeedRow): Feed => ({
  id: r.id, name: r.name, url: r.url, subscribed: !!r.subscribed, ...(r.icon ? { icon: r.icon } : {}),
});

export function listFeeds(db: Database, userId: string): Feed[] {
  return (db.query('SELECT * FROM feeds WHERE user_id = ? ORDER BY name').all(userId) as FeedRow[]).map(toFeed);
}

function getFeed(db: Database, userId: string, id: string): FeedRow {
  const row = db.query('SELECT * FROM feeds WHERE id = ? AND user_id = ?').get(id, userId) as FeedRow | null;
  if (!row) throw new HttpError(404, 'Feed nicht gefunden');
  return row;
}

function validate({ name, url }: Partial<FeedInput>) {
  if (name !== undefined && !name.trim()) throw new HttpError(400, 'Name fehlt');
  if (url !== undefined) assertPublicUrl(url);
}

export function addFeed(db: Database, userId: string, input: FeedInput): Feed {
  if (!input.name?.trim() || !input.url) throw new HttpError(400, 'Name und URL erforderlich');
  validate(input);
  const id = crypto.randomUUID();
  try {
    db.query('INSERT INTO feeds (id, user_id, name, url, icon) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, input.name.trim(), input.url, input.icon || null);
  } catch {
    throw new HttpError(409, 'Feed bereits vorhanden');
  }
  return toFeed(getFeed(db, userId, id));
}

export function updateFeed(
  db: Database, userId: string, id: string, patch: Partial<FeedInput> & { subscribed?: boolean },
): Feed {
  const cur = getFeed(db, userId, id);
  validate(patch);
  db.query('UPDATE feeds SET name = ?, url = ?, icon = ?, subscribed = ? WHERE id = ?').run(
    patch.name?.trim() ?? cur.name,
    patch.url ?? cur.url,
    patch.icon === undefined ? cur.icon : patch.icon || null,
    patch.subscribed === undefined ? cur.subscribed : patch.subscribed ? 1 : 0,
    id,
  );
  return toFeed(getFeed(db, userId, id));
}

export function deleteFeed(db: Database, userId: string, id: string): void {
  getFeed(db, userId, id);
  db.query('DELETE FROM feeds WHERE id = ?').run(id);
}
