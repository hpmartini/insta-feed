import { expect, test } from "bun:test";
import { clusterArticles, jaccard, wordSet, WINDOW_MS, type ClusterInput } from "../src/clustering";

const NOW = new Date("2026-01-10T12:00:00Z");
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();
const art = (id: string, title: string, msAgo = 1000, feedName = `feed-${id}`): ClusterInput => ({
  id, title, url: `https://${id}.test/x`, feedName, publishedAt: at(msAgo),
});
const ids = (cs: { articleIds: string[] }[]) => cs.map((c) => c.articleIds);

test("normalization: case, punctuation, unicode, digits", () => {
  expect([...wordSet("Hello, WORLD! 2024-25 (Über)")]).toEqual(["hello", "world", "2024", "25", "über"]);
  expect([...wordSet("ＡＢＣ")]).toEqual(["abc"]); // NFKC
  expect(wordSet("!!! ... —").size).toBe(0);
});

test("jaccard: empty sets are never similar", () => {
  expect(jaccard(new Set(), new Set())).toBe(0);
  expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  expect(jaccard(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(1);
  expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
});

test("two untitled / punctuation-only articles stay separate", () => {
  const out = clusterArticles([art("a", ""), art("b", ""), art("c", "!!!"), art("d", "???")], NOW);
  expect(out).toHaveLength(4);
});

test("threshold boundary: equal joins, below does not; digits matter", () => {
  // 3 of 4 distinct words shared → exactly 0.75
  const a = art("a", "one two three", 1), b = art("b", "one two three four", 2);
  expect(ids(clusterArticles([a, b], NOW))).toEqual([["a", "b"]]);
  expect(ids(clusterArticles([a, b], NOW, 0.76))).toEqual([["a"], ["b"]]);
  expect(clusterArticles([art("x", "Apollo 11"), art("y", "Apollo 12")], NOW)).toHaveLength(2);
  for (const t of [0, -1, 1.1, NaN]) expect(() => clusterArticles([], NOW, t)).toThrow(RangeError);
});

test("input permutations and ties give identical output", () => {
  const items = [
    art("c", "storm hits coast today", 5000),
    art("a", "storm hits coast today", 5000), // same time as c → id order
    art("b", "storm hits coast today", 1000),
    art("d", "markets rally strongly", 2000),
    art("e", "markets rally strongly", 2000),
  ];
  const expected = clusterArticles(items, NOW);
  expect(ids(expected)).toEqual([["b", "a", "c"], ["d", "e"]]);
  const perms = [[...items].reverse(), [items[3]!, items[0]!, items[4]!, items[2]!, items[1]!]];
  for (const p of perms) expect(clusterArticles(p, NOW)).toEqual(expected);
});

test("48 h window: inclusive bounds; undated, unparsable and future excluded", () => {
  const out = clusterArticles(
    [
      art("edge", "edge case", WINDOW_MS),
      art("old", "old news", WINDOW_MS + 1),
      art("future", "from the future", -1),
      art("now", "right now", 0),
      { id: "undated", title: "undated", url: "https://u.test/x", feedName: "u" },
      { ...art("bad", "bad date"), publishedAt: "not a date" },
    ],
    NOW,
  );
  expect(out.flatMap((c) => c.articleIds).sort()).toEqual(["edge", "now"]);
});

test("no bridge clusters: membership needs similarity to every member", () => {
  // a~b (0.6), b~c (0.6), a≁c (0.33) → c must not chain in through b.
  const a = art("a", "w1 w2 w3 w4", 3), b = art("b", "w2 w3 w4 w5", 2), c = art("c", "w3 w4 w5 w6", 1);
  expect(jaccard(wordSet(a.title), wordSet(b.title))).toBeCloseTo(0.6);
  const out = clusterArticles([a, b, c], NOW, 0.6);
  expect(ids(out)).toEqual([["c", "b"], ["a"]]);
});

test("sources: merged over members, deduplicated, feed names and URLs kept", () => {
  const a = art("a", "same title here", 1, "Feed A");
  const b = { ...art("b", "same title here", 2, "Feed B"), url: a.url }; // same article URL via second feed
  const c = art("c", "same title here", 3, "Feed C");
  const [cluster] = clusterArticles([c, b, a], NOW);
  expect(cluster!.sources).toEqual([
    { name: "Feed A", url: a.url, origin: "feed" },
    { name: "Feed C", url: c.url, origin: "feed" },
  ]);
  expect(cluster!.title).toBe("same title here");
});

test("cluster id derives from the member set; inputs are not mutated", () => {
  const items = [art("b", "alpha beta", 2), art("a", "alpha beta", 1)];
  const snap = JSON.stringify(items);
  const x = clusterArticles(items, NOW);
  expect(JSON.stringify(items)).toBe(snap);
  expect(clusterArticles([...items].reverse(), NOW)[0]!.id).toBe(x[0]!.id);
  expect(clusterArticles([items[0]!], NOW)[0]!.id).not.toBe(x[0]!.id);
});
