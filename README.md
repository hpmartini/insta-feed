# InstaFeed

RSS-Reader mit KI-Zusammenfassung und Story-Clustering. Next.js (App Router) + Bun, Architektur nach BakeNews.
Die frühere Angular-/Firebase-App ist entfernt (Git-Historie vor dem Commit „InstaFeed neu in Next.js auf Bun").

## Start

```sh
bun install
bun run dev      # API :4000 + Web :3000 → http://localhost:3000
bun run build    # Next.js Production-Build
bun run typecheck
bun test         # offline, Feeds und KI gemockt
```

Registrieren unter `/register`, Feeds unter `/feeds` anlegen, Artikel unter `/`.

## Umgebungsvariablen

| Variable | Default | Zweck |
|:--|:--|:--|
| `GEMINI_API_KEY` | – | Aktiviert Gemini (`gemini-2.5-flash`); ohne Key läuft der deterministische Mock |
| `DATABASE_PATH` | `./data/instafeed.db` | SQLite-Datei (`bun:sqlite`), `:memory:` möglich |
| `API_PORT` | `4000` | Port der API |
| `API_URL` | `http://localhost:4000` | Ziel des `/api`-Rewrites in Next.js |
| `GEMINI_BASE_URL` | Google-Endpoint | nur Test: Gemini-Endpunkt überschreiben |
| `ALLOW_PRIVATE_URLS` | – | `1` deaktiviert den SSRF-Schutz (nur lokal/E2E, nie produktiv) |

Keine Secrets im Repo; `.env*` ist ignoriert.

## Architektur

```
apps/web          Next.js UI (Login, Artikel, Artikel-Detail, Feeds, Row Runner, Einstellungen)
apps/api          Bun.serve-API: Auth, Feeds, Artikel, Proxy, KI, Einstellungen (SQLite)
packages/shared   Typen + Story-Clustering (Jaccard über Titel)
packages/api-client  typisierter fetch-Client für die API
```

- Web ruft nur `/api/*` auf; `next.config.ts` leitet an die API weiter (gleiche Origin → Cookie-Session `instafeed_session`, HttpOnly).
- Auth: E-Mail + Passwort (`Bun.password`), Sessions in SQLite. Feeds, Abos und Einstellungen gehören dem Nutzer.
- Artikel: Feeds (RSS 2 / RDF / Atom, `fast-xml-parser`) aller abonnierten Feeds, neueste zuerst; Volltext über serverseitigen Proxy (Readability + linkedom, SSRF-Grundschutz gegen localhost/private IPs).
- KI: `AiAdapter` (`apps/api/src/ai`) mit `mockAdapter` (erste Sätze, Titel-Clustering) und `geminiAdapter` (REST, Fallback auf Mock beim Clustering bei ungültiger Antwort). Wahl über `GEMINI_API_KEY`.
- Row Runner: `/runner` zeigt Schlagzeilen (oder `?url=` Volltext) als Laufschrift, Tempo aus den Einstellungen.

## Bekannte Grenzen

- SSRF-Schutz: Host-Literale + jeder Redirect-Hop geprüft, aber keine DNS-Auflösung (Rebinding möglich); vor öffentlichem Betrieb IP auflösen und pinnen.
- `/api/ai/summary` nimmt Text vom angemeldeten Client; Quota/Rate-Limit fehlt.
- Kein Rate-Limit, keine E-Mail-Verifikation; Feeds werden bei jedem Abruf neu geladen (kein Cache).

## Verifikation

Zusätzlich zu `bun test` wurde die UI per Headless-Chrome (Playwright) durchgespielt: Registrierung, Feed anlegen/bearbeiten/abbestellen, Artikel-Übersicht (neueste zuerst), Story-Gruppierung, Artikel-Detail mit Zusammenfassung, Row Runner, Einstellungen (persistiert, Dark-Theme), Abmelden. Lauf einmal mit Mock und einmal mit `GEMINI_API_KEY` gegen einen lokalen Fake-Gemini-Server (`GEMINI_BASE_URL`). Echte Gemini-API wurde mangels Key nicht aufgerufen.

E2E-Skript: `e2e/` (`bun e2e/fake-server.ts`; App mit `ALLOW_PRIVATE_URLS=1 [GEMINI_API_KEY=x GEMINI_BASE_URL=http://127.0.0.1:5055] bun run dev`; dann `bun add -d playwright-core` und `bun e2e/run.mjs [gemini|mock]`, Chrome-Pfad per `CHROME_PATH`).
