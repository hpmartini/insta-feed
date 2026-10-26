import type { Database } from 'bun:sqlite';
import type { ArticleListItem, Feed } from '@instafeed/shared';
import type { AiAdapter } from './ai';
import { extractArticle } from './article';
import {
  createSession, destroySession, login, register, SESSION_COOKIE, sessionCookie, userForSession,
} from './auth';
import { addFeed, deleteFeed, listFeeds, updateFeed } from './feeds';
import { assertPublicUrl, HttpError, json } from './http';
import { parseFeed } from './rss';
import { getSettings, saveSettings } from './settings';

export interface AppDeps {
  db: Database;
  ai: AiAdapter;
  /** Injected so tests never hit the network. */
  fetchImpl?: typeof fetch;
}

const cookieOf = (req: Request, name: string) =>
  req.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

export function createApp({ db, ai, fetchImpl = fetch }: AppDeps) {
  async function fetchText(url: string): Promise<string> {
    // Redirects are followed by hand so every hop is validated (no redirect-to-localhost bypass).
    for (let hop = 0; hop < 5; hop++) {
      assertPublicUrl(url);
      const res = await fetchImpl(url, {
        headers: { 'user-agent': 'InstaFeed/1.0' }, redirect: 'manual', signal: AbortSignal.timeout(10_000),
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (next) {
        url = new URL(next, url).href;
        continue;
      }
      if (!res.ok) throw new HttpError(502, `Quelle antwortete mit ${res.status}`);
      return res.text();
    }
    throw new HttpError(502, 'Zu viele Weiterleitungen');
  }

  /** Items of all subscribed feeds (or one feed), newest first. A broken feed is skipped, not fatal. */
  async function loadArticles(userId: string, feedId?: string): Promise<ArticleListItem[]> {
    const feeds = listFeeds(db, userId).filter((f: Feed) => f.subscribed && (!feedId || f.id === feedId));
    const perFeed = await Promise.all(
      feeds.map(async (f) => {
        try {
          return parseFeed(await fetchText(f.url)).map((i) => ({ ...i, feedId: f.id, feedName: f.name }));
        } catch {
          return [];
        }
      }),
    );
    return perFeed.flat().sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }

  async function route(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '');
    const m = req.method;
    const body = async () => ((await req.json().catch(() => ({}))) as Record<string, any>);

    if (m === 'POST' && path === '/auth/register') {
      const b = await body();
      const user = await register(db, String(b.email ?? ''), String(b.password ?? ''), String(b.name ?? ''));
      return json({ user }, 201, { 'set-cookie': sessionCookie(createSession(db, user.id)) });
    }
    if (m === 'POST' && path === '/auth/login') {
      const b = await body();
      const user = await login(db, String(b.email ?? ''), String(b.password ?? ''));
      return json({ user }, 200, { 'set-cookie': sessionCookie(createSession(db, user.id)) });
    }
    if (m === 'POST' && path === '/auth/logout') {
      const token = cookieOf(req, SESSION_COOKIE);
      if (token) destroySession(db, token);
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
    }

    // Everything below needs a session.
    const user = userForSession(db, cookieOf(req, SESSION_COOKIE));
    if (!user) throw new HttpError(401, 'Nicht angemeldet');

    if (m === 'GET' && path === '/auth/me') return json({ user });
    if (m === 'GET' && path === '/feeds') return json({ feeds: listFeeds(db, user.id) });
    if (m === 'POST' && path === '/feeds') return json({ feed: addFeed(db, user.id, (await body()) as any) }, 201);
    const feedMatch = path.match(/^\/feeds\/([^/]+)$/);
    if (feedMatch && m === 'PATCH') return json({ feed: updateFeed(db, user.id, feedMatch[1]!, await body()) });
    if (feedMatch && m === 'DELETE') {
      deleteFeed(db, user.id, feedMatch[1]!);
      return json({ ok: true });
    }

    if (m === 'GET' && path === '/articles') {
      return json({ articles: await loadArticles(user.id, url.searchParams.get('feedId') || undefined) });
    }
    if (m === 'GET' && path === '/article') {
      const target = url.searchParams.get('url') ?? '';
      return json(extractArticle(await fetchText(target), target));
    }

    if (m === 'POST' && path === '/ai/summary') {
      const b = await body();
      const summary = await ai.summarize({ title: String(b.title ?? ''), text: String(b.text ?? '') });
      return json({ summary, provider: ai.provider });
    }
    if (m === 'GET' && path === '/ai/clusters') {
      const articles = await loadArticles(user.id, url.searchParams.get('feedId') || undefined);
      return json({ clusters: await ai.cluster(articles), provider: ai.provider });
    }

    if (m === 'GET' && path === '/settings') return json({ settings: getSettings(db, user.id) });
    if (m === 'PUT' && path === '/settings') return json({ settings: saveSettings(db, user.id, await body()) });

    throw new HttpError(404, 'Nicht gefunden');
  }

  return async (req: Request): Promise<Response> => {
    try {
      return await route(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Interner Fehler' }, 500);
    }
  };
}
