import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SCHEMA_VERSION = 1;

const V1 = `
create table users (
  id text primary key,
  email text not null unique,           -- normalisiert (trim, lowercase) durch die Auth-Schicht
  password_hash text not null,
  created_at text not null
);
create table sessions (
  token_hash text primary key,          -- nur gehasht gespeichert
  user_id text not null references users(id) on delete cascade,
  expires_at text not null
);
create index sessions_user on sessions(user_id);
create index sessions_expires on sessions(expires_at);
create table feeds (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  url text not null,
  title text not null,
  icon_url text,
  subscribed integer not null default 1,
  unique (user_id, url),
  unique (id, user_id)
);
create table articles (
  id text primary key,
  feed_id text not null,
  user_id text not null,
  guid text not null,
  url text not null,
  title text not null,
  content text not null,
  published_at text,
  unique (feed_id, guid),
  foreign key (feed_id, user_id) references feeds(id, user_id) on delete cascade
);
create index articles_user_published on articles(user_id, published_at desc);
create index articles_feed on articles(feed_id);
create table settings (
  user_id text primary key references users(id) on delete cascade,
  speed real not null default 30,
  default_feed_id text,
  foreign key (default_feed_id, user_id) references feeds(id, user_id)
);
create table ai_cache (
  user_id text not null references users(id) on delete cascade,
  operation text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_fingerprint text not null,
  result text not null,
  created_at text not null,
  primary key (user_id, operation, provider, model, prompt_version, input_fingerprint)
);
`;

const MIGRATIONS = [V1];

export function openDb(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.run("pragma foreign_keys = on");
  return db;
}

/** Idempotent: applies pending steps, each atomically with its user_version bump. */
export function migrate(db: Database, migrations: string[] = MIGRATIONS): void {
  db.run("begin immediate");
  try {
    const { user_version: v } = db.query("pragma user_version").get() as { user_version: number };
    if (v > migrations.length) {
      throw new Error(`database schema v${v} is newer than supported v${migrations.length}`);
    }
    for (let i = v; i < migrations.length; i++) {
      db.run(migrations[i]!);
      db.run(`pragma user_version = ${i + 1}`);
    }
    db.run("commit");
  } catch (e) {
    db.run("rollback");
    throw e;
  }
}
