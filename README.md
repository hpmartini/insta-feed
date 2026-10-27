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

**Auth:** `POST /auth/register` (201) und `POST /auth/login` (200) setzen das Cookie `session` (HttpOnly, SameSite=Lax, Path=/, 30 Tage, `Secure` bei HTTPS) und liefern den User; `GET /auth/me` (200), `POST /auth/logout` (204, löscht Sitzung + Cookie). Öffentlich sind nur diese beiden POSTs und `GET /health`; alles andere ohne gültige Sitzung → 401. Passwort: `Bun.password` argon2id (8–256 Zeichen), E-Mail getrimmt + kleingeschrieben (Dublette → 409), Falschdaten → 401. Sitzungstoken: 32 Zufallsbytes, in der DB nur als SHA-256. Mutierende Requests mit vorhandenem, fremdem Origin → 403 (fehlender Origin, z. B. curl, ist erlaubt; Web :3000 → API :3001 braucht daher später einen Proxy/gleichen Origin).

```sh
curl -c jar -H 'content-type: application/json' -d '{"email":"a@b.de","password":"geheim1234"}' localhost:3001/auth/register
curl -b jar localhost:3001/auth/me
```

**Feeds** (Sitzung nötig, alles per `user_id` gefiltert; fremde oder unbekannte ID → 404, auch bei ungültigem Body): `GET /feeds` (eigene, inkl. abbestellter), `POST /feeds` (201; `url` http(s) + `title` Pflicht, `iconUrl?`, `subscribed?` Vorgabe `true`), `GET /feeds/:id`, `PATCH /feeds/:id` (200; Teilupdate, mind. ein Feld; `iconUrl: null` entfernt das Icon; `{ "subscribed": true|false }` abonniert/abbestellt idempotent, Artikel bleiben), `DELETE /feeds/:id` (204; leert eigene `default_feed_id`, Artikel per Kaskade weg). Unbekannte Felder (`id`, `userId`, `user_id`, …) und ungültige Eingaben → 400 (zod, strict); eigene doppelte URL → 409 (gleiche URL bei anderem Nutzer erlaubt). Kein Netzwerkabruf beim Anlegen/Ändern.

**Stand:** Gerüst + Schema + Shared-Verträge + Auth + Feeds-CRUD/Abo. Abruf-Absicherung (SSRF), Import und KI-Kuratierung sind noch nicht portiert.
