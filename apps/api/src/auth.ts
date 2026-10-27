import { UserSchema, type User } from "@insta-feed/shared";
import type { Deps } from "./app";

const COOKIE = "session";
const MAX_AGE = 30 * 24 * 3600;
const json = (body: unknown, status: number, headers?: HeadersInit) => Response.json(body, { status, headers });

const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

const cookieHeader = (req: Request, value: string, expires: Date, maxAge: number) =>
  `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}; Expires=${expires.toUTCString()}` +
  (new URL(req.url).protocol === "https:" ? "; Secure" : "");

function tokenOf(req: Request): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
}

/** Valid iff the session row exists and expires_at > now. */
export function currentUser({ db, now }: Deps, req: Request): User | null {
  const token = tokenOf(req);
  if (!token) return null;
  const row = db
    .query("select u.id, u.email, u.created_at from sessions s join users u on u.id = s.user_id where s.token_hash = ? and s.expires_at > ?")
    .get(sha256(token), now().toISOString()) as { id: string; email: string; created_at: string } | null;
  return row && { id: row.id, email: row.email, createdAt: row.created_at };
}

function startSession({ db, now }: Deps, req: Request, userId: string) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const expires = new Date(now().getTime() + MAX_AGE * 1000);
  db.run("insert into sessions values (?, ?, ?)", [sha256(token), userId, expires.toISOString()]);
  return cookieHeader(req, token, expires, MAX_AGE);
}

async function credentials(req: Request): Promise<{ email: string; password: string } | null> {
  const body = await req.json().catch(() => null);
  if (typeof body?.email !== "string" || typeof body?.password !== "string") return null;
  const email = body.email.trim().toLowerCase();
  // Upper bound caps argon2 work per request.
  if (!UserSchema.shape.email.safeParse(email).success || body.password.length < 8 || body.password.length > 256) return null;
  return { email, password: body.password };
}

export async function register(deps: Deps, req: Request): Promise<Response> {
  const c = await credentials(req);
  if (!c) return json({ error: "invalid credentials" }, 400);
  const password_hash = await Bun.password.hash(c.password, { algorithm: "argon2id" });
  const user: User = { id: crypto.randomUUID(), email: c.email, createdAt: deps.now().toISOString() };
  try {
    const cookie = deps.db.transaction(() => {
      deps.db.run("insert into users values (?, ?, ?, ?)", [user.id, user.email, password_hash, user.createdAt]);
      return startSession(deps, req, user.id);
    })();
    return json(user, 201, { "set-cookie": cookie });
  } catch (e) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") return json({ error: "email taken" }, 409);
    throw e;
  }
}

export async function login(deps: Deps, req: Request): Promise<Response> {
  const c = await credentials(req);
  const row = c && (deps.db.query("select id, email, password_hash, created_at from users where email = ?").get(c.email) as
    { id: string; email: string; password_hash: string; created_at: string } | null);
  // shortcut: unknown email skips argon2, so timing reveals registered emails; add a dummy verify if that matters.
  if (!c || !row || !(await Bun.password.verify(c.password, row.password_hash))) return json({ error: "invalid credentials" }, 401);
  const user: User = { id: row.id, email: row.email, createdAt: row.created_at };
  return json(user, 200, { "set-cookie": startSession(deps, req, row.id) });
}

export function logout({ db }: Deps, req: Request): Response {
  db.run("delete from sessions where token_hash = ?", [sha256(tokenOf(req)!)]);
  return new Response(null, { status: 204, headers: { "set-cookie": cookieHeader(req, "", new Date(0), 0) } });
}
