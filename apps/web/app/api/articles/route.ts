import { loadArticles } from "@/lib/articles";
import { authed, parseId } from "@/lib/http";

export const GET = authed(async (req, user) => {
  const feedId = new URL(req.url).searchParams.get("feedId");
  const { items, errors } = await loadArticles(user.id, feedId ? parseId(feedId) : undefined);
  return Response.json({ items, errors });
});
