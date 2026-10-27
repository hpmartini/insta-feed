import { HttpError } from "./errors";
import { userFromRequest, type User } from "./auth";

function fail(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error("[api]", e instanceof Error ? e.message : e);
  return Response.json({ error: "Interner Fehler" }, { status: 500 });
}

/** Public route handler: errors -> JSON. */
export function handle<C = unknown>(fn: (req: Request, ctx: C) => Response | Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return fail(e);
    }
  };
}

/** Route handler behind a session: no valid cookie -> 401. */
export function authed<C = unknown>(fn: (req: Request, user: User, ctx: C) => Response | Promise<Response>) {
  return handle<C>((req, ctx) => {
    const user = userFromRequest(req);
    if (!user) throw new HttpError(401, "Nicht angemeldet");
    return fn(req, user, ctx);
  });
}

/** Requiring application/json keeps cross-site HTML forms out (they cannot send it without a CORS preflight), which covers login CSRF. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Content-Type application/json erforderlich");
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "JSON-Objekt erwartet");
}

export function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Ungültige ID");
  return id;
}
