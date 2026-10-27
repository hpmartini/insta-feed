import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "./auth";

export async function currentUser() {
  return userForToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Call from every protected page, not only the layout: layouts are not re-run on client-side navigation. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
