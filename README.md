# InstaFeed

RSS-Reader als Bun-Workspaces-Monorepo.

| Pfad | Inhalt |
|:-----|:-------|
| `apps/web` | Next.js-Frontend (Platzhalter-Seite) |
| `apps/api` | Bun-API, SQLite via `bun:sqlite` (`/health`) |
| `packages/shared` | zod-Schemas/Typen (User, Feed, Article, Settings, Summary, StoryCluster, Source), `mergeSources` |
| `packages/api-client` | typisierter API-Client |

```sh
bun install
cp .env.example .env   # optional
bun run dev            # web :3000, api :3001
bun run typecheck && bun run build && bun test
```

**Persistenz:** `apps/api/src/index.ts` öffnet SQLite unter `DATABASE_PATH` (Vorgabe `data/insta-feed.db`, Elternordner wird angelegt, `:memory:` erlaubt) und migriert vor `Bun.serve`. Schema-Version in `PRAGMA user_version` (aktuell 1); Migration ist idempotent und atomar, höhere unbekannte Versionen werden abgelehnt. Tabellen: `users`, `sessions`, `feeds`, `articles`, `settings`, `ai_cache`.

**Injektion:** `createApp({ db, fetch, ai, now })` öffnet keine Dateien und liest keine Umgebung; `index.ts` verdrahtet (derzeit nur Mock-KI, ohne Key/Netz).

**Stand:** Gerüst + Schema + Shared-Verträge. Feeds, Auth, Abruf-Absicherung (SSRF) und KI-Kuratierung sind noch nicht portiert.

Lizenz: siehe `LICENSE`.
