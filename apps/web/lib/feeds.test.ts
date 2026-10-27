import { beforeEach, describe, expect, test } from "bun:test";
import { register } from "./auth";
import { resetDbForTests } from "./db";
import { createFeed, deleteFeed, getFeed, listFeeds, updateFeed } from "./feeds";
import { getSettings, saveSettings } from "./settings";

let a: number;
let b: number;

beforeEach(async () => {
  resetDbForTests();
  a = (await register("a@example.com", "geheim1234")).id;
  b = (await register("b@example.com", "geheim1234")).id;
});

describe("feeds", () => {
  test("create, list, update, subscribe/unsubscribe, delete", () => {
    const f = createFeed(a, { name: "Heise", url: "https://heise.de/rss" });
    expect(f).toMatchObject({ name: "Heise", subscribed: true, icon: "📰" });
    expect(listFeeds(a)).toEqual([f]);

    expect(updateFeed(a, f.id, { subscribed: false }).subscribed).toBe(false);
    expect(updateFeed(a, f.id, { name: "heise online", icon: "💻" })).toMatchObject({ name: "heise online", icon: "💻", subscribed: false });
    expect(updateFeed(a, f.id, { subscribed: true }).subscribed).toBe(true);

    deleteFeed(a, f.id);
    expect(listFeeds(a)).toEqual([]);
  });

  test("validation -> 400, duplicate URL per user -> 409", () => {
    expect(() => createFeed(a, { name: "", url: "https://x.test" })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => createFeed(a, { name: "X", url: "file:///etc/passwd" })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => createFeed(a, { name: "X", url: "kein url" })).toThrow(expect.objectContaining({ status: 400 }));
    createFeed(a, { name: "X", url: "https://x.test/rss" });
    expect(() => createFeed(a, { name: "Y", url: "https://x.test/rss" })).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => createFeed(b, { name: "Y", url: "https://x.test/rss" })).not.toThrow(); // another user may subscribe to the same URL
  });

  test("user B cannot see, change or delete user A's feed", () => {
    const f = createFeed(a, { name: "Privat", url: "https://a.test/rss" });
    expect(listFeeds(b)).toEqual([]);
    expect(() => getFeed(b, f.id)).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => updateFeed(b, f.id, { name: "gehackt" })).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => deleteFeed(b, f.id)).toThrow(expect.objectContaining({ status: 404 }));
    expect(getFeed(a, f.id).name).toBe("Privat");
  });
});

describe("settings", () => {
  test("defaults, partial update, per user", () => {
    expect(getSettings(a)).toMatchObject({ theme: "system", view: "list", speed: 5, defaultFeedId: null });
    saveSettings(a, { theme: "dark", speed: 8 });
    expect(getSettings(a)).toMatchObject({ theme: "dark", view: "list", speed: 8 });
    expect(getSettings(b).theme).toBe("system");
  });

  test("whitelist validation; default feed must be own", () => {
    expect(() => saveSettings(a, { theme: "neon" })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => saveSettings(a, { speed: 99 })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => saveSettings(a, { refreshMinutes: "5" })).toThrow(expect.objectContaining({ status: 400 }));
    const foreign = createFeed(b, { name: "B", url: "https://b.test/rss" });
    expect(() => saveSettings(a, { defaultFeedId: foreign.id })).toThrow(expect.objectContaining({ status: 400 }));
    const own = createFeed(a, { name: "A", url: "https://a.test/rss" });
    expect(saveSettings(a, { defaultFeedId: own.id }).defaultFeedId).toBe(own.id);
    deleteFeed(a, own.id);
    expect(getSettings(a).defaultFeedId).toBeNull();
  });
});
