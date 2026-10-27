import { createFeed, listFeeds } from "@/lib/feeds";
import { authed, readJson } from "@/lib/http";

export const GET = authed((_req, user) => Response.json(listFeeds(user.id)));

export const POST = authed(async (req, user) => Response.json(createFeed(user.id, await readJson(req)), { status: 201 }));
