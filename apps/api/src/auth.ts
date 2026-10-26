import type { Database } from 'bun:sqlite';
import type { User } from '@instafeed/shared';
import { HttpError } from './http';

export const SESSION_COOKIE = 'instafeed_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;

interface UserRow { id: string; email: string; name: string; password_hash: string }
const toUser = ({ id, email, name }: UserRow): User => ({ id, email, name });

export async function register(db: Database, email: string, password: string, name: string): Promise<User> {
  email = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Ungültige E-Mail');
  if (password.length < 8) throw new HttpError(400, 'Passwort muss mindestens 8 Zeichen haben');
  if (db.query('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'E-Mail bereits registriert');
  const row = { id: crypto.randomUUID(), email, name: name.trim() || email, password_hash: await Bun.password.hash(password) };
  db.query('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
    .run(row.id, row.email, row.name, row.password_hash);
  return toUser(row);
}

export async function login(db: Database, email: string, password: string): Promise<User> {
  const row = db.query('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | null;
  if (!row || !(await Bun.password.verify(password, row.password_hash))) {
    throw new HttpError(401, 'E-Mail oder Passwort falsch');
  }
  return toUser(row);
}

export function createSession(db: Database, userId: string): string {
  const token = crypto.randomUUID() + crypto.randomUUID();
  db.query('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + SESSION_MS);
  return token;
}

export function destroySession(db: Database, token: string): void {
  db.query('DELETE FROM sessions WHERE token = ?').run(token);
}

export function userForSession(db: Database, token: string | undefined): User | null {
  if (!token) return null;
  const row = db.query(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?',
  ).get(token, Date.now()) as UserRow | null;
  return row ? toUser(row) : null;
}

export const sessionCookie = (token: string, maxAge = SESSION_MS / 1000) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
