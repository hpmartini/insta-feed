import { fetchArticle } from "@/lib/article";
import { getCurrentUser } from "@/lib/session";

/** CORS proxy for article full text: GET /api/article?url=… (signed-in users only). */
export async function GET(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return Response.json({ error: "Parameter url fehlt" }, { status: 400 });
  try {
    return Response.json(await fetchArticle(url));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Fehler" }, { status: 502 });
  }
}
