import { createApp, type AiPort } from "./app";
import { migrate, openDb } from "./db";

const db = openDb(process.env.DATABASE_PATH ?? "data/insta-feed.db");
migrate(db);

// Placeholder until a real adapter exists: runs without key or network.
const ai: AiPort = {
  provider: "mock",
  model: "mock",
  summarize: async ({ title }) => title,
};

const app = createApp({ db, fetch, ai, now: () => new Date() });

const server = Bun.serve({ port: Number(process.env.API_PORT ?? 3001), fetch: app });
console.log(`api listening on ${server.url}`);
