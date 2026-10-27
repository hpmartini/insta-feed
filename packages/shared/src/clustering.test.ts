import { describe, expect, test } from "bun:test";
import { clusterItems, jaccardSimilarity, normalizeTitle } from "./clustering";
import type { FeedItem } from "./types";

const item = (id: string, title: string, publishedAt = "2025-10-06T10:00:00.000Z", description = ""): FeedItem => ({
  id, feedId: 1, feedName: "F", title, link: "", description, content: description, publishedAt,
});

describe("clustering", () => {
  test("normalizeTitle drops stop words and punctuation", () => {
    expect([...normalizeTitle("Der Bundestag: Ein Gesetz!")]).toEqual(["bundestag", "gesetz"]);
  });

  test("jaccard", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  test("groups similar headlines across feeds, keeps others apart", () => {
    const clusters = clusterItems(
      [
        item("1", "Bundestag beschließt neues Klimagesetz", "2025-10-06T08:00:00.000Z"),
        item("2", "Bundestag beschließt Klimagesetz nach langer Debatte", "2025-10-06T09:00:00.000Z", "Das Parlament stimmte zu. Weitere Details folgen."),
        item("3", "Fußball: Bayern gewinnt Topspiel"),
      ],
      0.5,
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0]!.itemIds).toEqual(["1", "2"]);
    expect(clusters[0]!.title).toBe("Bundestag beschließt Klimagesetz nach langer Debatte");
    expect(clusters[0]!.summary).toBe("Das Parlament stimmte zu. Weitere Details folgen.");
    expect(clusters[1]!.itemIds).toEqual(["3"]);
  });

  test("empty input", () => {
    expect(clusterItems([])).toEqual([]);
  });
});
