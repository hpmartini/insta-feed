import type { Database } from "bun:sqlite";
import type { HealthResponse } from "@insta-feed/shared";
import { currentUser, login, logout, register } from "./auth";
import { articleContent, listArticles, refreshFeed } from "./articles";
import { feeds } from "./feeds";
import type { Resolver } from "./safe-fetch";

/** Provider-neutral AI port; concrete adapters (mock, gemini, claude) are follow-up work. */
export interface AiPort {
  readonly provider: "mock" | "gemini" | "claude";
  readonly model: string;
  summarize(input: { title: string; content: string }): Promise<string>;
}

export interface Deps {
  db: Database;
  fetch: typeof fetch;
  /** DNS lookup used by safeFetch; defaults to the system resolver. */
  resolve?: Resolver;
  ai: AiPort;
  now: () => Date;
}

export function createApp(deps: Deps) {
  const { db } = deps;
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    // Missing Origin is allowed (curl, server-to-server); present-but-foreign, "null" or malformed is not.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin !== null && origin !== url.origin) {
      return Response.json({ error: "forbidden origin" }, { status: 403 });
    }
    const route = `${req.method} ${url.pathname}`;
    if (route === "GET /health") {
      const row = db.query("select sqlite_version() as v").get() as { v: string };
      return Response.json({ ok: true, sqlite: row.v } satisfies HealthResponse);
    }
    if (route === "POST /auth/register") return register(deps, req);
    if (route === "POST /auth/login") return login(deps, req);
    const user = currentUser(deps, req);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (route === "GET /auth/me") return Response.json(user);
    if (route === "POST /auth/logout") return logout(deps, req);
    const refresh = req.method === "POST" ? /^\/feeds\/([^/]+)\/refresh$/.exec(url.pathname) : null;
    if (refresh) return refreshFeed(deps, user, refresh[1]!);
    if (route === "GET /articles") return listArticles(deps, user, url);
    const content = req.method === "GET" ? /^\/articles\/([^/]+)\/content$/.exec(url.pathname) : null;
    if (content) return articleContent(deps, user, content[1]!);
    if (url.pathname === "/feeds" || url.pathname.startsWith("/feeds/")) return feeds(deps, user, req, url.pathname);
    return new Response("not found", { status: 404 });
  };
}
