# InstaFeed

RSS reader with AI: per-article summaries and story clustering across your feeds. Next.js (App Router) on Bun, data in a local SQLite file. No cloud account needed.

The former Angular 11 / Firebase app is gone (see [Legacy](#legacy)).

## Features

- Account: register, log in, log out; everything behind the login.
- Feeds: add by URL (name, URL, icon), edit, delete, subscribe / unsubscribe. Feeds belong to the user.
- Articles: all subscribed feeds, newest first, filter by feed, default feed from the settings, full text through a server-side proxy (no CORS).
- AI: summary per article, story clusters over all feeds. Gemini with `GEMINI_API_KEY`, a deterministic mock without it.
- Row Runner: headline ticker with pause, fullscreen and speed from the settings.
- Settings per user: theme (light / dark / system), list or card view, refresh interval, Row Runner speed, default feed.

## Start

Prerequisite: [Bun](https://bun.sh) 1.4 or newer (it provides `bun:sqlite` and `Bun.password`; Node alone cannot run this app).

```sh
bun install
bun run dev                    # http://localhost:3000
# or production
bun run build && bun run start
```

Open `/register`, create an account, add a feed under **Feeds** (for example `https://www.heise.de/rss/heise-atom.xml`).

## Environment variables

Copy `.env.example` if you want to set any of them. All are optional.

| Variable | Default | Meaning |
|:--|:--|:--|
| `GEMINI_API_KEY` | unset | Set: summaries and clustering via Gemini (`gemini-2.5-flash`). Unset: mock. Read from the environment only, never logged, never stored. |
| `DB_PATH` | `./data/instafeed.sqlite` | SQLite file, relative to `apps/web`. `:memory:` for throwaway data. |
| `CLUSTERING_THRESHOLD` | `0.5` | Jaccard similarity (0 to 1] for the mock clustering and its fallback. BakeNews uses 0.75; headlines of different outlets for the same story share few words, so this is lower. |

## Tests and checks

```sh
bun test            # offline: feed fetches, DNS and AI are mocked; DB is :memory:
bun run typecheck   # tsc over both workspaces
bun run build
```

Covered: RSS 2.0 / Atom / CDATA parsing (including hostile input), clustering, AI adapter (mock determinism, Gemini selection by env, fallback on errors and unparsable answers, answer validation), auth, feed CRUD and subscription with cross-user isolation, settings validation, SSRF guard, route handlers (401 without a session, CRUD, partial feed failure, JSON-only).

The Gemini call itself is not exercised against the real API (needs a key). Selection and fallback are tested with a stubbed client.

## Architecture

```
apps/web          Next.js app: pages, components, route handlers (app/api/**), lib/ (db, auth, feeds, proxy, ai)
packages/shared   framework-free TypeScript: types, RSS/Atom parser, clustering, AI adapter
```

- **Bun workspaces**, modelled on BakeNews. Two deliberate differences: there is no `apps/api` (Next route handlers are the backend; a second Hono server would duplicate them) and no `packages/api-client` (server components and handlers call the same `lib/` functions; the browser only uses a 10-line `fetch` helper). No turbo.
- **Why `bun --bun next`**: `bun:sqlite` and `Bun.password` only exist in the Bun runtime. The scripts force Bun for the Next server. Verified with `next dev`, `next build` and `next start`.
- **AI adapter** (`packages/shared/src/ai`): `AiAdapter { summarize, cluster }`, `getAiAdapter(env)` picks Gemini or the mock. The mock summarises with the first three sentences and clusters with Jaccard similarity on headlines (ported from BakeNews). Gemini errors and unusable answers fall back to the mock; cluster answers are validated against the item numbers that were sent, so the model cannot invent or duplicate articles. Summaries are cached in SQLite per user and adapter, so Gemini is asked once per article.
- **Articles are not stored.** They are fetched from the feeds on every request, each with a 10 s timeout. One broken feed shows an error and does not block the others.
- **Data model** (`apps/web/lib/db.ts`, created on first start): `users`, `sessions`, `feeds` (unique per user and URL), `settings`, `summaries`. Every feed, settings and summary query filters by `user_id`; a foreign id behaves like a missing one (404).

### Security

- **Passwords**: `Bun.password` (argon2id), 8 to 128 characters.
- **Sessions**: random 256-bit token in an httpOnly, `SameSite=Lax` cookie (`Secure` over https); only the token's SHA-256 is stored. 30 days, deleted on logout.
- **Route protection**: pages call `requireUser()` (layouts alone are not re-run on client navigation); every API handler answers 401 without a session. No middleware: it runs on the edge runtime, where SQLite is not available.
- **CSRF**: JSON endpoints require `Content-Type: application/json` (a cross-site form cannot send it) on top of `SameSite=Lax`.
- **SSRF guard** (`lib/proxy.ts`), used for feed fetches and the full-text proxy: http(s) only; localhost, `.local`, private, loopback, link-local, CGNAT and reserved ranges rejected, IPv6 limited to global unicast, IPv4-mapped and NAT64 unwrapped; every address the host resolves to is checked; each redirect hop is checked again; 10 s timeout; 2 MB cap.
  - *Known limit*: the check happens before the request and is not pinned to the connection, so DNS rebinding is not fully closed. Pin the resolved IP before hosting this publicly.
- **No markup from other sites is rendered**: the full-text proxy returns plain-text paragraphs (Readability + linkedom), feed links are only used in an `href` if they are http(s).
- **Parsers** use `indexOf` scans instead of lazy regexes, so hostile feeds cannot cause quadratic runtimes.

Not built: password reset, e-mail verification, login rate limiting, OPML import, a persistent article archive. Fine for a local or single-household install; add before exposing it publicly.

## Legacy

The Angular 11 / Firebase app (`src/`, `functions/`, `angular.json`, Firebase config, its GitHub Actions deploy workflows) was removed in the commit "Angular/Firebase-Altbestand entfernen". It is still in the git history. Feature mapping: Cloud Functions `getFeed` / `getArticle` / `setFeed` / `unsubscribe` / `saveSettings` are now `/api/articles`, `/api/article`, `/api/feeds`, `/api/settings`. The old Row Runner (typewriter animation of one article) became a headline ticker.
