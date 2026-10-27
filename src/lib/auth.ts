import type { Database } from "bun:sqlite";
import type { User } from "./types";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {}

function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function register(db: Database, email: string, password: string): Promise<User> {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) throw new AuthError("Ungültige E-Mail-Adresse");
  if (password.length < 8) throw new AuthError("Passwort muss mindestens 8 Zeichen haben");
  if (db.query("SELECT 1 FROM users WHERE email = ?").get(normalized)) {
    throw new AuthError("E-Mail ist bereits registriert");
  }
  const user: User = { id: crypto.randomUUID(), email: normalized };
  const passwordHash = await Bun.password.hash(password);
  try {
    db.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(user.id, user.email, passwordHash);
  } catch (e) {
    // A concurrent registration may win the race between the check above and this insert.
    if (e instanceof Error && e.message.includes("UNIQUE")) throw new AuthError("E-Mail ist bereits registriert");
    throw e;
  }
  return user;
}

export async function login(db: Database, email: string, password: string): Promise<User> {
  const row = db
    .query<{ id: string; email: string; password_hash: string }, [string]>(
      "SELECT id, email, password_hash FROM users WHERE email = ?",
    )
    .get(normalizeEmail(email));
  // Same message for unknown user and wrong password: no account enumeration.
  if (!row || !(await Bun.password.verify(password, row.password_hash))) {
    throw new AuthError("E-Mail oder Passwort falsch");
  }
  return { id: row.id, email: row.email };
}

/** Creates a session and returns the raw token; only its hash is stored. */
export function createSession(db: Database, userId: string, now = Date.now()): { token: string; expiresAt: Date } {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const expiresAt = now + SESSION_TTL_MS;
  db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), userId, expiresAt);
  return { token, expiresAt: new Date(expiresAt) };
}

export function getUserBySession(db: Database, token: string | undefined, now = Date.now()): User | null {
  if (!token) return null;
  const row = db
    .query<User & { expires_at: number }, [string]>(
      "SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    )
    .get(hashToken(token));
  if (!row) return null;
  if (row.expires_at <= now) {
    deleteSession(db, token);
    return null;
  }
  return { id: row.id, email: row.email };
}

export function deleteSession(db: Database, token: string): void {
  db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}
