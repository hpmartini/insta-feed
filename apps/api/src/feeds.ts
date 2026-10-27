import { FeedSchema, type Feed, type User } from "@insta-feed/shared";
import type { Deps } from "./app";

const json = (body: unknown, status: number) => Response.json(body, { status });
const notFound = () => json({ error: "not found" }, 404);

const { url, title, iconUrl, subscribed } = FeedSchema.shape;
// Strict: id/userId/user_id and any other key are rejected; the owner always comes from the session.
const CreateSchema = FeedSchema.pick({ url: true }).extend({
  title: title.trim().min(1),
  iconUrl: iconUrl.unwrap().nullable().optional(),
  subscribed: subscribed.removeDefault().optional(),
}).strict();
const UpdateSchema = CreateSchema.partial().refine((b) => Object.keys(b).length > 0, "no fields");

export type Row = { id: string; user_id: string; url: string; title: string; icon_url: string | null; subscribed: number; last_error: string | null };
const COLS = "id, user_id, url, title, icon_url, subscribed";
export const SELECT_COLS = `${COLS}, last_error`;
export const toFeed = (r: Row): Feed => ({
  id: r.id,
  userId: r.user_id,
  url: r.url,
  title: r.title,
  ...(r.icon_url !== null && { iconUrl: r.icon_url }),
  subscribed: r.subscribed === 1,
  ...(r.last_error !== null && { lastError: r.last_error }),
});

export async function feeds(deps: Deps, user: User, req: Request, path: string): Promise<Response> {
  const { db } = deps;
  const m = /^\/feeds(?:\/([^/]+))?$/.exec(path);
  if (!m) return notFound();
  const id = m[1];
  const own = (id: string) => db.query(`select ${SELECT_COLS} from feeds where id = ? and user_id = ?`).get(id, user.id) as Row | null;

  if (id === undefined) {
    if (req.method === "GET") {
      const rows = db.query(`select ${SELECT_COLS} from feeds where user_id = ? order by title, id`).all(user.id) as Row[];
      return json(rows.map(toFeed), 200);
    }
    if (req.method !== "POST") return notFound();
    const body = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "invalid input", issues: body.error.issues }, 400);
    const f = body.data;
    const row: Row = { id: crypto.randomUUID(), user_id: user.id, url: f.url, title: f.title, icon_url: f.iconUrl ?? null, subscribed: f.subscribed === false ? 0 : 1, last_error: null };
    try {
      db.run(`insert into feeds (${COLS}) values (?, ?, ?, ?, ?, ?)`, [row.id, row.user_id, row.url, row.title, row.icon_url, row.subscribed]);
    } catch (e) {
      if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") return json({ error: "feed url exists" }, 409);
      throw e;
    }
    return json(toFeed(row), 201);
  }

  const current = own(id); // ownership first, so foreign ids are 404 even for invalid bodies
  if (!current) return notFound();
  if (req.method === "GET") return json(toFeed(current), 200);
  if (req.method === "DELETE") {
    db.transaction(() => {
      db.run("update settings set default_feed_id = null where user_id = ? and default_feed_id = ?", [user.id, id]);
      db.run("delete from feeds where id = ? and user_id = ?", [id, user.id]);
    })();
    return new Response(null, { status: 204 });
  }
  if (req.method !== "PATCH") return notFound();
  const body = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid input", issues: body.error.issues }, 400);
  const p = body.data;
  const next: Row = {
    ...current,
    url: p.url ?? current.url,
    title: p.title ?? current.title,
    icon_url: p.iconUrl === undefined ? current.icon_url : p.iconUrl,
    subscribed: p.subscribed === undefined ? current.subscribed : p.subscribed ? 1 : 0,
  };
  try {
    db.run("update feeds set url = ?, title = ?, icon_url = ?, subscribed = ? where id = ? and user_id = ?", [next.url, next.title, next.icon_url, next.subscribed, id, user.id]);
  } catch (e) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") return json({ error: "feed url exists" }, 409);
    throw e;
  }
  return json(toFeed(next), 200);
}
