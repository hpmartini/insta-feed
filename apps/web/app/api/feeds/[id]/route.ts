import { deleteFeed, getFeed, updateFeed } from "@/lib/feeds";
import { authed, parseId, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, user, { params }) => Response.json(getFeed(user.id, parseId((await params).id))));

export const PATCH = authed<Ctx>(async (req, user, { params }) =>
  Response.json(updateFeed(user.id, parseId((await params).id), await readJson(req))),
);

export const DELETE = authed<Ctx>(async (_req, user, { params }) => {
  deleteFeed(user.id, parseId((await params).id));
  return new Response(null, { status: 204 });
});
