import { HttpError } from "@/lib/errors";
import { authed } from "@/lib/http";
import { loadArticle } from "@/lib/proxy";

/** Full-text proxy (replaces the old getArticle Cloud Function): server-side fetch, so no CORS, behind the SSRF guard. */
export const GET = authed(async (req) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) throw new HttpError(400, "url fehlt");
  return Response.json(await loadArticle(url));
});
