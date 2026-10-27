import type { Article, User } from "@insta-feed/shared";
import type { Deps } from "./app";
import { SELECT_COLS, toFeed, type Row as FeedRow } from "./feeds";
import { parseFeed } from "./parse-feed";
import { safeFetch } from "./safe-fetch";

const json = (body: unknown, status: number) => Response.json(body, { status });
const notFound = () => json({ error: "not found" }, 404);

type ArticleRow = { id: string; feed_id: string; guid: string; url: string; title: string; content: string; published_at: string | null };
const toArticle = (r: ArticleRow): Article => ({
  id: r.id,
  feedId: r.feed_id,
  guid: r.guid,
  url: r.url,
  title: r.title,
  content: r.content,
  ...(r.published_at !== null && { publishedAt: r.published_at }),
});

const fetchOpts = (deps: Deps) => ({ fetch: deps.fetch, resolve: deps.resolve });
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** GET /articles[?feedId=] — newest first, undated last; always scoped to the session user. */
export function listArticles({ db }: Deps, user: User, url: URL): Response {
  const feedId = url.searchParams.get("feedId");
  const rows = db
    .query(
      `select id, feed_id, guid, url, title, content, published_at from articles
       where user_id = ? and (? is null or feed_id = ?)
       order by published_at is null, published_at desc, id desc`,
    )
    .all(user.id, feedId, feedId) as ArticleRow[];
  return json(rows.map(toArticle), 200);
}

/** POST /feeds/:id/refresh — fetch, parse, then import idempotently in one short write transaction. */
export async function refreshFeed(deps: Deps, user: User, feedId: string): Promise<Response> {
  const { db } = deps;
  const ownFeed = () => db.query(`select ${SELECT_COLS} from feeds where id = ? and user_id = ?`).get(feedId, user.id) as FeedRow | null;
  const feed = ownFeed();
  if (!feed) return notFound();

  let error: string | undefined;
  let imported = 0;
  try {
    const res = await safeFetch(feed.url, fetchOpts(deps));
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    const drafts = await parseFeed(res.text);
    // The feed may have been deleted or re-pointed while we were fetching; never import stale results.
    const stale = db.transaction(() => {
      const current = ownFeed();
      if (!current || current.url !== feed.url) return true;
      const insert = db.prepare(
        "insert or ignore into articles (id, feed_id, user_id, guid, url, title, content, published_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const d of drafts) {
        imported += insert.run(crypto.randomUUID(), feed.id, user.id, d.guid, d.url, d.title, d.content, d.publishedAt ?? null).changes;
      }
      db.run("update feeds set last_error = null where id = ? and user_id = ?", [feed.id, user.id]);
      return false;
    })();
    if (stale) return json({ error: "feed changed during refresh" }, 409);
  } catch (e) {
    error = errorMessage(e);
    db.run("update feeds set last_error = ? where id = ? and user_id = ? and url = ?", [error, feed.id, user.id, feed.url]);
  }
  const body = { feed: toFeed(ownFeed() ?? feed), imported };
  return error === undefined ? json(body, 200) : json({ ...body, error }, 502);
}

const BLOCK_TAGS = "p,br,div,li,ul,ol,h1,h2,h3,h4,h5,h6,article,section,blockquote,pre,tr,table";
const SKIP_TAGS = "script,style,noscript,template,svg,head,nav,header,footer,aside,form,iframe";
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (m, dec, hex, name) => {
    const cp = dec ? Number(dec) : hex ? parseInt(hex, 16) : undefined;
    if (cp === undefined) return ENTITIES[name.toLowerCase() as string] ?? m;
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });

/** Text extraction via HTMLRewriter: parses only, runs no scripts and loads no resources. Decodes common entities only. */
export async function extractText(html: string): Promise<string> {
  const BREAK = "\u0000";
  let skip = 0;
  let out = "";
  await new HTMLRewriter()
    .on(SKIP_TAGS, {
      element(el) {
        if (el.selfClosing || !el.onEndTag) return;
        skip++;
        el.onEndTag(() => void skip--);
      },
    })
    .on(BLOCK_TAGS, {
      element(el) {
        out += BREAK;
        el.onEndTag?.(() => void (out += BREAK));
      },
    })
    .on("*", {
      text(t) {
        if (skip === 0) out += t.text;
      },
    })
    .transform(new Response(html))
    .text();
  return out
    .split(BREAK)
    .map((p) => decode(p).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** GET /articles/:id/content — fetches only the stored link of an article in one of the user's own feeds. */
export async function articleContent(deps: Deps, user: User, id: string): Promise<Response> {
  const row = deps.db
    .query(
      `select a.url, a.content from articles a join feeds f on f.id = a.feed_id and f.user_id = a.user_id
       where a.id = ? and a.user_id = ?`,
    )
    .get(id, user.id) as { url: string; content: string } | null;
  if (!row) return notFound();
  const fallback = () => json({ text: row.content, url: row.url, fallback: true }, 200);
  try {
    const res = await safeFetch(row.url, fetchOpts(deps));
    if (res.status < 200 || res.status >= 300 || !/html/i.test(res.contentType)) return fallback();
    const text = await extractText(res.text);
    return text ? json({ text, url: row.url, fallback: false }, 200) : fallback();
  } catch {
    return fallback();
  }
}
