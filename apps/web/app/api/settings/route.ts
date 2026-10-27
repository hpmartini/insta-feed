import { authed, readJson } from "@/lib/http";
import { getSettings, saveSettings } from "@/lib/settings";

export const GET = authed((_req, user) => Response.json(getSettings(user.id)));

export const PUT = authed(async (req, user) => Response.json(saveSettings(user.id, await readJson(req))));
