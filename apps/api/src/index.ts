import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createAi } from './ai';
import { createApp } from './app';
import { openDb } from './db';

const dbPath = process.env.DATABASE_PATH ?? './data/instafeed.db';
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const ai = createAi();
const server = Bun.serve({
  port: Number(process.env.API_PORT ?? 4000),
  fetch: createApp({ db: openDb(dbPath), ai }),
});
console.log(`InstaFeed API on ${server.url} (AI: ${ai.provider})`);
