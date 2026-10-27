import { summarize } from "@/lib/ai";
import { authed, readJson } from "@/lib/http";

export const POST = authed(async (req, user) => {
  const b = await readJson(req);
  const summary = await summarize(user.id, { url: String(b.url ?? ""), title: String(b.title ?? ""), content: String(b.content ?? "") });
  return Response.json({ summary });
});
