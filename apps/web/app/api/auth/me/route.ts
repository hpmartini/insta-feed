import { authed } from "@/lib/http";

export const GET = authed((_req, user) => Response.json(user));
