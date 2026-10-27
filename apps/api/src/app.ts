import type { Database } from "bun:sqlite";
import type { HealthResponse } from "@insta-feed/shared";

export function createApp(db: Database) {
  return (req: Request): Response => {
    if (new URL(req.url).pathname === "/health") {
      const row = db.query("select sqlite_version() as v").get() as { v: string };
      return Response.json({ ok: true, sqlite: row.v } satisfies HealthResponse);
    }
    return new Response("not found", { status: 404 });
  };
}
