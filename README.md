# InstaFeed

RSS-Reader mit KI-Zusammenfassung und Story-Clustering. Next.js (App Router, TypeScript) auf Bun, Daten lokal in SQLite.

Version 2 ersetzt die frühere Angular-11-/Firebase-App (im Git-Verlauf bis Commit `061e800`). Architektur und KI-Schicht folgen BakeNews.

## Start

Voraussetzung: [Bun](https://bun.sh) ≥ 1.4.

```sh
bun install
bun run dev        # http://localhost:3000
```

Danach registrieren, unter **Feeds** einen RSS- oder Atom-Feed per URL hinzufügen und unter **Artikel** lesen.

| Befehl | Zweck |
|:--|:--|
| `bun run dev` | Entwicklungsserver |
| `bun run build` / `bun run start` | Produktions-Build und -Server |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit-Tests, offline: Feeds und KI sind gemockt |

Alle Next-Befehle laufen mit `bun --bun`. Nur so ist `bun:sqlite` verfügbar.

## Umgebungsvariablen

Alle Variablen sind optional. Vorlage: `.env.example`, kopieren nach `.env.local`.

| Variable | Standard | Wirkung |
|:--|:--|:--|
| `GEMINI_API_KEY` | – | Ist der Key gesetzt, laufen Zusammenfassung und Clustering über Gemini. Ohne Key greift ein deterministischer Mock. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini-Modell |
| `DB_PATH` | `./data/instafeed.sqlite` | SQLite-Datei; wird beim ersten Zugriff angelegt |
| `CLUSTERING_THRESHOLD` | `0.5` | Jaccard-Schwelle für das Mock-Clustering (0..1) |

## Funktionen

- **Konto:** Registrieren, Anmelden, Abmelden. Passwörter werden mit argon2 gehasht (`Bun.password`). Die Session liegt in einem httpOnly-Cookie, in der Datenbank steht nur ihr SHA-256-Hash.
- **Feeds** (`/feeds`): Feeds per Name, URL und Icon hinzufügen, bearbeiten, abonnieren, abbestellen und löschen. Jeder Feed gehört einem Nutzer.
- **Artikel** (`/articles`): Artikel aller abonnierten Feeds, neueste zuerst. Filter nach Feed. Zwei Ansichten: Liste oder Stories (KI-Cluster über Feeds hinweg).
- **Artikel-Detail** (`/articles/read?url=…`): Der Server holt den Volltext und extrahiert ihn mit Readability. So entsteht kein CORS-Problem. Dazu kommt eine KI-Zusammenfassung. Derselbe Proxy steht als JSON unter `GET /api/article?url=…` bereit.
- **Row Runner** (`/row-runner?url=…`): Laufschrift, die den Artikel Zeichen für Zeichen schreibt. Mit Start/Stopp und Vollbild; das Tempo kommt aus den Einstellungen.
- **Einstellungen** (`/settings`): Theme, Standard-Ansicht, Standard-Feed, Auto-Aktualisierung und Row-Runner-Tempo.

## Architektur

```
src/
  app/                 Next.js App Router
    (auth)/            /login, /register
    (app)/             geschützte Seiten; jede ruft requireUser()
    api/article/       Volltext-Proxy als JSON
    actions.ts         Server Actions (Auth, Feeds, Einstellungen)
  components/          Client-Komponenten (Formulare, RowRunner, AutoRefresh)
  lib/
    types.ts           Domänentypen, auch AiAdapter
    db.ts              bun:sqlite, Schema, getDb()/createDb()
    auth.ts            Registrierung, Login, Sessions
    session.ts         Cookie-Session für Next (requireUser)
    feeds.ts           Feed-CRUD und Abos, immer pro Nutzer
    settings.ts        Einstellungen pro Nutzer, validiert
    net.ts             safeFetch: URL-Prüfung, DNS-Check gegen interne IPs, Redirects Hop für Hop
    rss.ts             RSS-2.0-/Atom-Parser, fetchFeed, mergeItems
    reader.ts          lädt alle Feeds parallel; ein defekter Feed blockiert die anderen nicht
    article.ts         Volltext über Readability und linkedom
    typewriter.ts      Frame-Logik des Row Runners
    ai/                austauschbare KI-Schicht
      index.ts         getAi(): Gemini mit GEMINI_API_KEY, sonst Mock
      gemini.ts        @google/genai; bei Fehlern Fallback auf den Mock
      mock.ts          deterministisch: extraktive Zusammenfassung + Jaccard-Clustering
      cluster.ts       Titel-Clustering, portiert aus BakeNews
```

**Was aus BakeNews übernommen ist:**

- Die KI steckt hinter einer Fassade (`getAi()`, wie `services/llm/index.ts`) und lässt sich tauschen.
- Gemini wird mit `gemini-2.5-flash` und JSON-Antworten angesprochen.
- Das Story-Clustering per Jaccard-Ähnlichkeit mit Stoppwörtern kommt aus `services/clustering.ts`.
- Die Schichtung folgt BakeNews: Typen, Services, Routen.

**Bewusst anders als BakeNews:**

- **Kein Monorepo.** Mit dem App Router liefert Next.js Web und API in einer App. `apps/api` und `packages/api-client` wären nur Duplikate. Die Paketgrenzen von BakeNews sind hier Module unter `src/lib`.
- **SQLite über `bun:sqlite` statt Postgres, Redis und Queues.** Die App läuft lokal ohne Cloud-Konto.
- **Sessions statt JWT mit Refresh-Tokens.** Bei einer Server-gerenderten App ist das einfacher.
- **Routenschutz im Server-Code (`requireUser`), nicht in `proxy.ts`.** Der Proxy kann `bun:sqlite` nicht laden.

**Grenzen:**

- Feed- und Artikelabrufe laufen über `safeFetch`. Das blockt Nicht-http(s)-URLs und interne Ziele (localhost, private, link-local und IPv4-mapped Adressen) bei jedem Redirect-Hop, auch nach der DNS-Auflösung. Offen bleibt ein DNS-Rebinding-Fenster zwischen Prüfung und Verbindung. Für öffentlichen Betrieb deshalb einen Egress-Proxy mit IP-Pinning vorschalten.
- KI-Ergebnisse werden nicht gecacht. Mit Gemini kostet jeder Aufruf der Story-Ansicht einen API-Call.
- Die Silbentrennung im Row Runner übernimmt CSS `hyphens: auto` (`lang="de"`); die alte hypher-Bibliothek ist entfallen.

## Lizenz

[![CC BY NC SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

Dieses Werk steht unter der
[Creative Commons Attribution NonCommercial ShareAlike 4.0 International License][cc-by-nc-sa].

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY%20NC%20SA%204.0-lightgrey.svg
