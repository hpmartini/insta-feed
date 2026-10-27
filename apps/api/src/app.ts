import type { Database } from "bun:sqlite";
import type { HealthResponse } from "@insta-feed/shared";

/** Provider-neutral AI port; concrete adapters (mock, gemini, claude) are follow-up work. */
export interface AiPort {
  readonly provider: "mock" | "gemini" | "claude";
  readonly model: string;
  summarize(input: { title: string; content: string }): Promise<string>;
}

export interface Deps {
  db: Database;
  fetch: typeof fetch;
  ai: AiPort;
  now: () => Date;
}

export function createApp({ db }: Deps) {
  return (req: Request): Response => {
    if (new URL(req.url).pathname === "/health") {
      const row = db.query("select sqlite_version() as v").get() as { v: string };
      return Response.json({ ok: true, sqlite: row.v } satisfies HealthResponse);
    }
    return new Response("not found", { status: 404 });
  };
}
