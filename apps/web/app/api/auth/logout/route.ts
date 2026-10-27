import { destroySession, sessionCookie, tokenFromRequest } from "@/lib/auth";
import { handle } from "@/lib/http";

export const POST = handle((req) => {
  destroySession(tokenFromRequest(req));
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie(req, "", 0) } });
});
