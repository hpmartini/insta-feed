import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createDb } from "./db";
import { AuthError, createSession, deleteSession, getUserBySession, login, register } from "./auth";
import { addFeed, deleteFeed, getFeed, listFeeds, setSubscribed, updateFeed } from "./feeds";
import { DEFAULT_SETTINGS, getSettings, saveSettings } from "./settings";

// argon2 password hashing is deliberately slow.
setDefaultTimeout(30_000);

let db: Database;
beforeEach(() => {
  db = createDb(":memory:");
});

describe("auth", () => {
  test("register, login, wrong password", async () => {
    const user = await register(db, " Ada@Example.org ", "geheim123");
    expect(user.email).toBe("ada@example.org");
    expect((await login(db, "ADA@example.org", "geheim123")).id).toBe(user.id);
    await expect(login(db, "ada@example.org", "falsch123")).rejects.toThrow(AuthError);
    await expect(login(db, "nobody@example.org", "geheim123")).rejects.toThrow("E-Mail oder Passwort falsch");
  });

  test("rejects duplicates, bad email, short password", async () => {
    await register(db, "a@b.de", "geheim123");
    await expect(register(db, "A@B.de", "geheim123")).rejects.toThrow("bereits registriert");
    await expect(register(db, "kein-mail", "geheim123")).rejects.toThrow("E-Mail");
    await expect(register(db, "c@d.de", "kurz")).rejects.toThrow("8 Zeichen");
  });

  test("stores only a hash of the password", async () => {
    await register(db, "a@b.de", "geheim123");
    const row = db.query<{ password_hash: string }, []>("SELECT password_hash FROM users").get();
    expect(row!.password_hash).not.toContain("geheim123");
  });

  test("session lifecycle and expiry", async () => {
    const user = await register(db, "a@b.de", "geheim123");
    const { token } = createSession(db, user.id, 0);
    expect(getUserBySession(db, token, 1)).toEqual(user);
    expect(getUserBySession(db, "unknown")).toBeNull();
    expect(getUserBySession(db, undefined)).toBeNull();
    expect(getUserBySession(db, token, Number.MAX_SAFE_INTEGER)).toBeNull();

    const second = createSession(db, user.id);
    deleteSession(db, second.token);
    expect(getUserBySession(db, second.token)).toBeNull();
  });
});

describe("feeds", () => {
  let alice: string;
  let bob: string;
  beforeEach(async () => {
    alice = (await register(db, "alice@x.de", "geheim123")).id;
    bob = (await register(db, "bob@x.de", "geheim123")).id;
  });

  test("CRUD scoped to the owner", () => {
    const feed = addFeed(db, alice, { name: " Tagesschau ", url: "https://www.tagesschau.de/xml/rss2" });
    expect(feed).toMatchObject({ name: "Tagesschau", icon: "📰", subscribed: true, userId: alice });
    expect(listFeeds(db, bob)).toEqual([]);
    expect(getFeed(db, bob, feed.id)).toBeNull();

    const updated = updateFeed(db, alice, feed.id, { name: "TS", url: feed.url, icon: "🗞️" });
    expect(updated).toMatchObject({ name: "TS", icon: "🗞️" });
    expect(() => updateFeed(db, bob, feed.id, { name: "x", url: feed.url })).toThrow("nicht gefunden");

    deleteFeed(db, bob, feed.id);
    expect(listFeeds(db, alice)).toHaveLength(1);
    deleteFeed(db, alice, feed.id);
    expect(listFeeds(db, alice)).toEqual([]);
  });

  test("subscribe / unsubscribe", () => {
    const a = addFeed(db, alice, { name: "A", url: "https://a.example/rss" });
    addFeed(db, alice, { name: "B", url: "https://b.example/rss" });
    setSubscribed(db, alice, a.id, false);
    expect(listFeeds(db, alice, { subscribedOnly: true }).map((f) => f.name)).toEqual(["B"]);
    expect(listFeeds(db, alice)).toHaveLength(2);
    expect(() => setSubscribed(db, bob, a.id, true)).toThrow("nicht gefunden");

    // Adding the same URL again re-subscribes instead of duplicating.
    addFeed(db, alice, { name: "A2", url: "https://a.example/rss" });
    expect(listFeeds(db, alice, { subscribedOnly: true }).map((f) => f.name)).toEqual(["A2", "B"]);
  });

  test("same URL for different users is independent", () => {
    addFeed(db, alice, { name: "A", url: "https://a.example/rss" });
    addFeed(db, bob, { name: "A", url: "https://a.example/rss" });
    expect(listFeeds(db, alice)).toHaveLength(1);
    expect(listFeeds(db, bob)).toHaveLength(1);
  });

  test("validates input", () => {
    expect(() => addFeed(db, alice, { name: "", url: "https://a.example" })).toThrow("Name");
    expect(() => addFeed(db, alice, { name: "x", url: "not a url" })).toThrow("Ungültige URL");
    expect(() => addFeed(db, alice, { name: "x", url: "file:///etc/passwd" })).toThrow("http");
    const b = addFeed(db, alice, { name: "B", url: "https://b.example/rss" });
    addFeed(db, alice, { name: "C", url: "https://c.example/rss" });
    expect(() => updateFeed(db, alice, b.id, { name: "B", url: "https://c.example/rss" })).toThrow("bereits");
  });
});

describe("settings", () => {
  test("defaults, save, sanitize", async () => {
    const id = (await register(db, "a@b.de", "geheim123")).id;
    expect(getSettings(db, id)).toEqual(DEFAULT_SETTINGS);
    const saved = saveSettings(db, id, { theme: "dark", view: "stories", speed: "500", refreshMinutes: "5", defaultFeedId: "" });
    expect(saved).toEqual({ theme: "dark", view: "stories", speed: 100, refreshMinutes: 5, defaultFeedId: null });
    expect(getSettings(db, id)).toEqual(saved);
    expect(saveSettings(db, id, { theme: "neon", speed: "abc" })).toMatchObject({ theme: "system", speed: 30 });
  });
});
