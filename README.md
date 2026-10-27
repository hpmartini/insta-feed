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

**Persistenz:** `apps/api/src/index.ts` öffnet SQLite unter `DATABASE_PATH` (Vorgabe `data/insta-feed.db`, Elternordner wird angelegt, `:memory:` erlaubt) und migriert vor `Bun.serve`. Schema-Version in `PRAGMA user_version` (aktuell 3; v2 ergänzt `feeds.last_error`, v3 `settings.theme/view/refresh_minutes` und begrenzt Alt-Tempo auf 1–100); Migration ist idempotent und atomar, höhere unbekannte Versionen werden abgelehnt. Tabellen: `users`, `sessions`, `feeds`, `articles`, `settings`, `ai_cache`.

**Injektion:** `createApp({ db, fetch, resolve?, ai, now })` öffnet keine Dateien und liest keine Umgebung; `index.ts` verdrahtet den KI-Adapter über `createAiAdapter` (einzige Stelle, die `AI_PROVIDER`/`GEMINI_API_KEY` liest).

**Auth:** `POST /auth/register` (201) und `POST /auth/login` (200) setzen das Cookie `session` (HttpOnly, SameSite=Lax, Path=/, 30 Tage, `Secure` bei HTTPS) und liefern den User; `GET /auth/me` (200), `POST /auth/logout` (204, löscht Sitzung + Cookie). Öffentlich sind nur diese beiden POSTs und `GET /health`; alles andere ohne gültige Sitzung → 401. Passwort: `Bun.password` argon2id (8–256 Zeichen), E-Mail getrimmt + kleingeschrieben (Dublette → 409), Falschdaten → 401. Sitzungstoken: 32 Zufallsbytes, in der DB nur als SHA-256. Mutierende Requests mit vorhandenem, fremdem Origin → 403 (fehlender Origin, z. B. curl, ist erlaubt; Web :3000 → API :3001 braucht daher später einen Proxy/gleichen Origin).

```sh
curl -c jar -H 'content-type: application/json' -d '{"email":"a@b.de","password":"geheim1234"}' localhost:3001/auth/register
curl -b jar localhost:3001/auth/me
```

**Feeds** (Sitzung nötig, alles per `user_id` gefiltert; fremde oder unbekannte ID → 404, auch bei ungültigem Body): `GET /feeds` (eigene, inkl. abbestellter), `POST /feeds` (201; `url` http(s) + `title` Pflicht, `iconUrl?`, `subscribed?` Vorgabe `true`), `GET /feeds/:id`, `PATCH /feeds/:id` (200; Teilupdate, mind. ein Feld; `iconUrl: null` entfernt das Icon; `{ "subscribed": true|false }` abonniert/abbestellt idempotent, Artikel bleiben), `DELETE /feeds/:id` (204; leert eigene `default_feed_id`, Artikel per Kaskade weg). Unbekannte Felder (`id`, `userId`, `user_id`, …) und ungültige Eingaben → 400 (zod, strict); eigene doppelte URL → 409 (gleiche URL bei anderem Nutzer erlaubt). Kein Netzwerkabruf beim Anlegen/Ändern.

**Import und Artikel** (Sitzung nötig, alles per `user_id` gefiltert; fremde oder unbekannte ID → 404 ohne Netzwerkzugriff):

| Route | Antwort |
|:------|:--------|
| `POST /feeds/:id/refresh` | 200 `{ feed, imported }`; Fehler → 502 `{ feed, imported: 0, error }` und `feed.lastError` gesetzt; Feed währenddessen gelöscht/umgestellt → 409 |
| `GET /articles[?feedId=]` | `Article[]`, neueste zuerst (`published_at DESC, id DESC`), undatierte zuletzt |
| `GET /articles/:id/content` | `{ text, url, fallback }` |

- Parsing: `parseFeed(xml)` (`rss-parser`, RSS und Atom, rein). Kennung = GUID/Atom-ID, sonst Link; Titel fehlt → Link; Snippet fehlt → `""`; ungültiges/fehlendes Datum → weggelassen; Einträge ohne http(s)-Link werden übersprungen; kaputtes XML → Fehler.
- Import: Abruf und Parsing vor einer kurzen Schreibtransaktion, `INSERT OR IGNORE` auf `UNIQUE(feed_id, guid)` → wiederholbar, keine Duplikate. Erfolg löscht `last_error`, Fehler setzt ihn (max. 200 Zeichen) nur am betroffenen Feed; vorhandene Artikel bleiben.
- Inhalt: lädt ausschließlich den gespeicherten Link eines Artikels eigener Feeds (nie eine URL aus dem Request). HTML wird per `HTMLRewriter` zu Text (kein Skript, keine Nachladungen; Skripte, Styles, Navigation, Header/Footer ausgeschlossen, Absätze erhalten, nur häufige Entitäten dekodiert, Text wird als UTF-8 gelesen). Fehler, Status ≠ 2xx, kein HTML oder leeres Ergebnis → `{ text: <gespeichertes Snippet>, url, fallback: true }`.
- **`safeFetch`** (jeder ausgehende Abruf): nur http(s), keine URL-Zugangsdaten, Loopback/private/Link-Local/CGNAT/Multicast/reservierte Bereiche gesperrt (IPv4 in allen Schreibweisen, IPv6 nur 2000::/3, IPv4-mapped und 6to4 geprüft), alle DNS-Antworten müssen öffentlich sein, höchstens 3 Weiterleitungen (jedes Ziel neu geprüft), 10 s Gesamtzeit (inkl. DNS und Body), 2 MiB Body-Limit beim Streamen, keine Cookies.
- **Bekannte Lücke:** DNS-Rebinding. Die Adresse wird vorab geprüft, `fetch` löst erneut auf. Behebung: Verbindung an die geprüfte IP binden (Host und TLS-Prüfung erhalten).

**Stand:** Gerüst, Schema, Shared-Verträge, Auth, Feeds-CRUD/Abo, Feed-Import, Artikelliste, Inhaltsextraktion, safeFetch. KI-Zusammenfassung und Story-Clustering (siehe unten). Noch nicht portiert: Ticker/Frontend-Seiten.

## KI (`apps/api/src/ai`, `clustering.ts`)

Auswahl (`createAiAdapter`): `AI_PROVIDER=mock` erzwingt den Mock, auch mit Key; sonst Gemini bei nichtleerem `GEMINI_API_KEY`; sonst Mock. Ohne Key läuft alles offline.

| Route | Antwort |
|:------|:--------|
| `POST /articles/:id/summary` | 200 `Summary` (`text`, `sources` = aktueller Originallink, `provider`, `model`, `promptVersion`, `createdAt`); fremde/unbekannte ID → 404 vor Cache und Anbieter; Gemini-Fehler → 502, kein Fallback, kein Cache-Eintrag |
| `GET /stories` | 200 `StoryCluster[]` der eigenen Artikel, neueste Story zuerst, `[]` ohne Treffer |

- **Mock** ist eine echte, deterministische Funktion der Eingabe (Titel + gekürzter Inhalt), keine Zusammenfassung im KI-Sinn; die Antwort trägt `provider: "mock"`.
- **Gemini:** `@google/genai`, `gemini-2.5-flash`, `responseSchema` + JSON-MIME, 20 s Limit. Antwort wird mit zod validiert; Transportfehler, leere Antwort, kaputtes JSON und Schemaverletzung → 502 mit fester Meldung (kein SDK-Text, kein Key). Provider/Modell setzt der Server, nie die Modellantwort.
- **Cache** (`ai_cache`): Schlüssel = Nutzer, Operation, Provider, Modell, `PROMPT_VERSION` und SHA-256 über (Titel, Inhalt, Provider, Modell, `PROMPT_VERSION`). Nur validierte Erfolge; defekte Einträge zählen als Miss. Artikel-ID und Quellen kommen bei jeder Antwort vom aktuellen Artikel. `PROMPT_VERSION` bei jeder Prompt-/Schemaänderung erhöhen.
- **Clustering:** Jaccard über Titel-Wörter (NFKC, Kleinschreibung, Satzzeichen = Trenner, Ziffern bleiben), Schwelle 0,75. Leere Wortmengen sind nie ähnlich (BakeNews: 1). Ein Artikel kommt in die erste Gruppe, zu **jedem** Mitglied er ähnlich genug ist (keine Brückencluster). Sortierung: Zeit absteigend, dann ID; unabhängig von der Eingabereihenfolge. Fenster: Veröffentlichung in [jetzt − 48 h, jetzt]; undatierte, unlesbare und zukünftige Artikel entfallen. Quellen per `mergeSources`.
- **Label:** Stories sind eine lokale Heuristik, kein KI-Aufruf: `provider: "mock"`, `model`/`promptVersion: "jaccard-v1"` (bei Algorithmusänderung erhöhen).
- **Grenzen:** keine Stoppwörter, nur Titel verglichen; Gemini-Erreichbarkeit nur per Stub getestet.

## Einstellungen (`/settings`)

Auth-pflichtig, Nutzer immer aus der Sitzung. Felder (snake_case, alle fünf Pflicht):

| Feld | Werte | Vorgabe |
|:-----|:------|:--------|
| `theme` | `system` \| `light` \| `dark` | `system` |
| `view` | `list` \| `cards` | `list` |
| `refresh_minutes` | ganze Zahl 0–1440 (0 = aus) | `0` |
| `speed` | Zahl 1–100, ms pro Zeichen (Row-Runner) | `30` |
| `default_feed_id` | eigene Feed-ID oder `null` | `null` |

- `GET`: legt beim ersten Abruf die Vorgaben an (nur für den Aufrufer), überschreibt nie.
- `PUT`: ersetzt alle fünf Felder vollständig, auch vor dem ersten `GET`; antwortet mit dem gespeicherten Stand.
- Fehler: `400` ungültig (fehlende/zusätzliche Felder, falscher Typ, Tempo außerhalb 1–100, kaputtes JSON), `401` ohne/abgelaufene Sitzung, `403` fremder Origin, `404` fremde oder unbekannte `default_feed_id` (nichts wird geändert).
- Feed löschen setzt `default_feed_id` auf `null`.
- Theme-/View-Werte und Refresh-Bereich stammen aus dem Legacy-Code; die Vorgabe `refresh_minutes: 0` ist neu festgelegt (Legacy ebenfalls 0).
