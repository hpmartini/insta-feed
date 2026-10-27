import { createSession, login, sessionCookie } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle, readJson } from "@/lib/http";

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const user = await login(String(body.email ?? ""), String(body.password ?? ""));
  if (!user) throw new HttpError(401, "E-Mail oder Passwort falsch");
  const { token, maxAge } = createSession(user.id);
  return Response.json(user, { headers: { "set-cookie": sessionCookie(req, token, maxAge) } });
});
