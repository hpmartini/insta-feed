import { expect, test } from "bun:test";
import { mergeSources, SettingsSchema, SourceSchema } from "./index";
import type { Source } from "./index";

const s = (url: string, origin: Source["origin"] = "feed", name = url): Source => ({ name, url, origin });

test("empty / missing lists", () => {
  expect(mergeSources()).toEqual([]);
  expect(mergeSources([], [])).toEqual([]);
  expect(mergeSources(undefined, [s("https://a.test/x", "ai")])).toHaveLength(1);
});

test("origin first, origin wins on duplicate, dedup within lists", () => {
  const out = mergeSources(
    [s("https://A.test/x"), s("https://a.test/x")],
    [s("https://a.test/x", "ai"), s("https://b.test/y", "ai")],
  );
  expect(out.map((x) => [x.url, x.origin])).toEqual([["https://A.test/x", "feed"], ["https://b.test/y", "ai"]]);
});

test("same host different articles / path case stay distinct; no '#' identity", () => {
  expect(mergeSources([s("https://a.test/x")], [s("https://a.test/y"), s("https://a.test/X")])).toHaveLength(3);
  expect(mergeSources([s("#", "feed", "A")], [s("#", "ai", "B")])).toHaveLength(2);
});

test("inputs not mutated", () => {
  const o = [s("https://a.test/x")], e = [s("https://a.test/x", "ai")];
  const snap = JSON.stringify([o, e]);
  mergeSources(o, e).push(s("https://c.test"));
  expect(JSON.stringify([o, e])).toBe(snap);
});

test("schemas", () => {
  expect(SettingsSchema.parse({})).toEqual({ speed: 30 });
  expect(SourceSchema.safeParse({ name: "x", url: "javascript:alert(1)", origin: "feed" }).success).toBe(false);
});
