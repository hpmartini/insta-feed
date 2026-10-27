import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createApp } from "./app";

test("/health answers from bun:sqlite", async () => {
  const res = createApp(new Database(":memory:"))(new Request("http://x/health"));
  const body = (await res.json()) as { ok: boolean; sqlite: string };
  expect(body.ok).toBe(true);
  expect(body.sqlite).toMatch(/^\d+\.\d+/);
});
