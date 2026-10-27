import { DEFAULT_SETTINGS, SettingsSchema, type Settings, type User } from "@insta-feed/shared";
import type { Deps } from "./app";

const json = (body: unknown, status: number) => Response.json(body, { status });

const COLS = "theme, view, refresh_minutes, speed, default_feed_id";

export function settings(deps: Deps, user: User, req: Request): Promise<Response> | Response {
  const { db } = deps;
  const read = () => db.query(`select ${COLS} from settings where user_id = ?`).get(user.id) as Settings;

  if (req.method === "GET") {
    const d = DEFAULT_SETTINGS;
    db.run("insert into settings (user_id, theme, view, refresh_minutes, speed, default_feed_id) values (?, ?, ?, ?, ?, ?) on conflict(user_id) do nothing",
      [user.id, d.theme, d.view, d.refresh_minutes, d.speed, d.default_feed_id]);
    return json(read(), 200);
  }
  if (req.method !== "PUT") return new Response("not found", { status: 404 });
  return put();

  // Full replace: strict schema, owner always from the session.
  async function put() {
    const body = SettingsSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "invalid input", issues: body.error.issues }, 400);
    const s = body.data;
    if (s.default_feed_id !== null && !db.query("select 1 from feeds where id = ? and user_id = ?").get(s.default_feed_id, user.id)) {
      return json({ error: "not found" }, 404);
    }
    db.run(
      `insert into settings (user_id, ${COLS}) values (?, ?, ?, ?, ?, ?)
       on conflict(user_id) do update set theme = excluded.theme, view = excluded.view, refresh_minutes = excluded.refresh_minutes, speed = excluded.speed, default_feed_id = excluded.default_feed_id`,
      [user.id, s.theme, s.view, s.refresh_minutes, s.speed, s.default_feed_id],
    );
    return json(read(), 200);
  }
}
