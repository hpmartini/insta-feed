import { createSession, register, sessionCookie } from "@/lib/auth";
import { handle, readJson } from "@/lib/http";

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const user = await register(String(body.email ?? ""), String(body.password ?? ""));
  const { token, maxAge } = createSession(user.id);
  return Response.json(user, { status: 201, headers: { "set-cookie": sessionCookie(req, token, maxAge) } });
});
