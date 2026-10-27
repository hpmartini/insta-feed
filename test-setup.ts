import { mock } from "bun:test";

// Tests never touch disk or network: in-memory DB, no Gemini key, every hostname "resolves" to a public IP
// (fetch itself is stubbed per test), so the SSRF guard's DNS step needs no resolver.
process.env.DB_PATH = ":memory:";
delete process.env.GEMINI_API_KEY;
mock.module("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
