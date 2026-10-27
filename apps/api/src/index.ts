import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app";

const dbPath = process.env.DATABASE_PATH ?? "data/insta-feed.db";
mkdirSync(dirname(dbPath), { recursive: true });
const app = createApp(new Database(dbPath, { create: true }));

const server = Bun.serve({ port: Number(process.env.API_PORT ?? 3001), fetch: app });
console.log(`api listening on ${server.url}`);
