import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { HttpError } from "./errors";

export const SESSION_COOKIE = "instafeed_session";
const SESSION_DAYS = 30;

export interface User {
  id: number;
  email: string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function register(email: string, password: string): Promise<User> {
  email = String(email ?? "").trim().toLowerCase();
  password = String(password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, "Ungültige E-Mail-Adresse");
  if (password.length < 8 || password.length > 128) throw new HttpError(400, "Passwort muss 8 bis 128 Zeichen lang sein");
  // Bun.password defaults to argon2id
  const hash = await Bun.password.hash(password);
  try {
    const row = getDb()
      .query("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id")
      .get(email, hash, Date.now()) as { id: number };
    return { id: row.id, email };
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new HttpError(409, "E-Mail ist bereits registriert");
    throw e;
  }
}

// Verified when the email is unknown, so a miss costs as much as a wrong password.
let dummyHash: Promise<string> | undefined;

export async function login(email: string, password: string): Promise<User | null> {
  const row = getDb()
    .query("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(String(email ?? "").trim()) as (User & { password_hash: string }) | null;
  const hash = row?.password_hash ?? (await (dummyHash ??= Bun.password.hash("dummy-password")));
  const ok = await Bun.password.verify(String(password ?? ""), hash);
  return row && ok ? { id: row.id, email: row.email } : null;
}

/** Opaque random token; only its hash is stored, so a leaked DB does not leak live sessions. */
export function createSession(userId: number): { token: string; maxAge: number } {
  const token = randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 86400;
  getDb()
    .query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(sha256(token), userId, Date.now() + maxAge * 1000);
  getDb().query("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  return { token, maxAge };
}

export function destroySession(token: string | undefined) {
  if (token) getDb().query("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function userForToken(token: string | undefined): User | null {
  if (!token) return null;
  return getDb()
    .query("SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(sha256(token), Date.now()) as User | null;
}

export function tokenFromRequest(req: Request): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
}

export function userFromRequest(req: Request): User | null {
  return userForToken(tokenFromRequest(req));
}

/** Secure only over https, so `bun run start` on http://localhost keeps working. */
export function sessionCookie(req: Request, token: string, maxAge: number): string {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? "; Secure" : ""}`;
}
