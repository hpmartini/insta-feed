import { beforeEach, describe, expect, test } from "bun:test";
import { createSession, destroySession, login, register, userForToken } from "./auth";
import { resetDbForTests } from "./db";

beforeEach(resetDbForTests);

describe("auth", () => {
  test("register -> login -> session -> logout", async () => {
    const user = await register("Anna@Example.com", "geheim1234");
    expect(user.email).toBe("anna@example.com");

    expect(await login("anna@example.com", "geheim1234")).toEqual(user);

    const { token } = createSession(user.id);
    expect(userForToken(token)).toEqual(user);

    destroySession(token);
    expect(userForToken(token)).toBeNull();
  });

  test("duplicate email -> 409, case-insensitive", async () => {
    await register("a@example.com", "geheim1234");
    await expect(register("A@EXAMPLE.com", "anderes1234")).rejects.toMatchObject({ status: 409 });
  });

  test("validation: bad email, short password -> 400", async () => {
    await expect(register("kein-email", "geheim1234")).rejects.toMatchObject({ status: 400 });
    await expect(register("a@example.com", "kurz")).rejects.toMatchObject({ status: 400 });
  });

  test("wrong password and unknown user -> null", async () => {
    await register("a@example.com", "geheim1234");
    expect(await login("a@example.com", "falsch1234")).toBeNull();
    expect(await login("niemand@example.com", "geheim1234")).toBeNull();
  });

  test("password is hashed (argon2id), token is stored hashed", async () => {
    const { getDb } = await import("./db");
    const user = await register("a@example.com", "geheim1234");
    const { token } = createSession(user.id);
    const row = getDb().query("SELECT password_hash FROM users").get() as { password_hash: string };
    expect(row.password_hash).toStartWith("$argon2id$");
    expect(getDb().query("SELECT 1 FROM sessions WHERE token_hash = ?").get(token)).toBeNull();
  });

  test("expired session is rejected", async () => {
    const { getDb } = await import("./db");
    const user = await register("a@example.com", "geheim1234");
    const { token } = createSession(user.id);
    getDb().query("UPDATE sessions SET expires_at = 1").run();
    expect(userForToken(token)).toBeNull();
  });
});
