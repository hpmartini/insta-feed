import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSession, deleteSession, getUserBySession } from "./auth";
import { getDb } from "./db";
import type { User } from "./types";

const COOKIE = "instafeed_session";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return getUserBySession(getDb(), (await cookies()).get(COOKIE)?.value);
});

/** Guards protected pages; route protection lives here because proxy.ts cannot reach bun:sqlite. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = createSession(getDb(), userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(getDb(), token);
  jar.delete(COOKIE);
}
