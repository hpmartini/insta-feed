import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT NOT NULL,
  subscribed INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, url)
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  view TEXT NOT NULL,
  refresh_minutes INTEGER NOT NULL,
  speed INTEGER NOT NULL,
  default_feed_id INTEGER REFERENCES feeds(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS summaries (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  PRIMARY KEY (user_id, item_key)
);
`;

// On globalThis so Next dev's module reloads do not open a second handle.
const g = globalThis as unknown as { __instafeedDb?: Database };

export function getDb(): Database {
  if (!g.__instafeedDb) {
    const path = process.env.DB_PATH || "./data/instafeed.sqlite";
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path, { create: true });
    db.run("PRAGMA foreign_keys = ON");
    if (path !== ":memory:") db.run("PRAGMA journal_mode = WAL");
    db.run(SCHEMA);
    g.__instafeedDb = db;
  }
  return g.__instafeedDb;
}

export function resetDbForTests() {
  g.__instafeedDb?.close();
  g.__instafeedDb = undefined;
}
