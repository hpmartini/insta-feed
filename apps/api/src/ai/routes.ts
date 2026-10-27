import { createHash } from "node:crypto";
import { StoryClusterSchema, SummarySchema, type User } from "@insta-feed/shared";
import type { Deps } from "../app";
import { CLUSTER_VERSION, clusterArticles } from "../clustering";
import { AiProviderError, PROMPT_VERSION, SummaryPayloadSchema } from "./adapter";

const json = (body: unknown, status: number) => Response.json(body, { status });

const fingerprint = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

type Row = { id: string; title: string; content: string; url: string; feed_title: string; published_at: string | null };
const ROW_SQL = `select a.id, a.title, a.content, a.url, f.title as feed_title, a.published_at
  from articles a join feeds f on f.id = a.feed_id and f.user_id = a.user_id where a.user_id = ?`;

/** POST /articles/:id/summary — only successes are cached; provider failures surface as 502. */
export async function summarizeArticle(deps: Deps, user: User, id: string): Promise<Response> {
  const { db, ai } = deps;
  const a = db.query(`${ROW_SQL} and a.id = ?`).get(user.id, id) as Row | null;
  if (!a) return json({ error: "not found" }, 404);

  const fp = fingerprint([a.title, a.content, ai.provider, ai.model, PROMPT_VERSION]);
  const key = [user.id, "summary", ai.provider, ai.model, PROMPT_VERSION, fp];
  const hit = db
    .query(
      "select result, created_at from ai_cache where user_id = ? and operation = ? and provider = ? and model = ? and prompt_version = ? and input_fingerprint = ?",
    )
    .get(...key) as { result: string; created_at: string } | null;

  // A corrupt cache entry counts as a miss and is overwritten below.
  let payload = hit ? SummaryPayloadSchema.safeParse(safeJson(hit.result)) : undefined;
  let createdAt = hit?.created_at ?? "";
  if (!payload?.success) {
    try {
      payload = SummaryPayloadSchema.safeParse(await ai.summarize({ title: a.title, content: a.content }));
    } catch (e) {
      if (!(e instanceof AiProviderError)) throw e;
      return json({ error: e.message }, 502);
    }
    if (!payload.success) return json({ error: "ai adapter returned an invalid payload" }, 502);
    createdAt = deps.now().toISOString();
    db.run("insert or replace into ai_cache values (?, ?, ?, ?, ?, ?, ?, ?)", [...key, JSON.stringify(payload.data), createdAt]);
  }
  // Identity and sources come from the current article, never from the cache entry.
  return json(
    SummarySchema.parse({
      articleId: a.id,
      text: payload.data.text,
      sources: [{ name: a.feed_title || a.url, url: a.url, origin: "feed" }],
      provider: ai.provider,
      model: ai.model,
      promptVersion: PROMPT_VERSION,
      createdAt,
    }),
    200,
  );
}

/** GET /stories — local Jaccard heuristic over the user's own recent articles; no AI call. */
export function listStories({ db, now }: Deps, user: User): Response {
  const rows = db.query(ROW_SQL).all(user.id) as Row[];
  const clusters = clusterArticles(
    rows.map((r) => ({ id: r.id, title: r.title, url: r.url, feedName: r.feed_title || r.url, publishedAt: r.published_at ?? undefined })),
    now(),
  );
  const createdAt = now().toISOString();
  return json(
    clusters.map((c) =>
      StoryClusterSchema.parse({ ...c, provider: "mock", model: CLUSTER_VERSION, promptVersion: CLUSTER_VERSION, createdAt }),
    ),
    200,
  );
}
