import { createApp } from "./app";
import { createAiAdapter } from "./ai/factory";
import { migrate, openDb } from "./db";

const db = openDb(process.env.DATABASE_PATH ?? "data/insta-feed.db");
migrate(db);

const ai = createAiAdapter({ provider: process.env.AI_PROVIDER, geminiApiKey: process.env.GEMINI_API_KEY });

const app = createApp({ db, fetch, ai, now: () => new Date() });

const server = Bun.serve({ port: Number(process.env.API_PORT ?? 3001), fetch: app });
console.log(`api listening on ${server.url}`);
