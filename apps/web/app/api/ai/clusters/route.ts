import { loadStories } from "@/lib/ai";
import { authed } from "@/lib/http";

export const GET = authed(async (_req, user) => Response.json(await loadStories(user.id)));
