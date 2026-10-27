# Plan (attempt 2)

## Ambition
- Altitude: InstaFeed wird wieder ein wartbarer RSS-Reader, der lokal sofort läuft. Eigene Feeds bekommen KI-Kuratierung aus BakeNews: Zusammenfassung sowie Story-Clustering mit Quellen. Neue Features und ein späterer Anbieterwechsel (Gemini/Claude) gehen ohne Umbau.
- Depth: Ausgangsmaterial ist Primärquellcode, kein Digest: functions/src/index.ts (Proxy, Abo, Settings), die Angular-Komponenten (row-runner speed/autostart/fullscreen), BakeNews gemini.ts, llm/index.ts, clustering.ts, shared/sources.ts und api-client. Was ein Profi zusätzlich tut:
  - jeden ausgehenden Abruf als SSRF-Grenze behandeln (http(s), Private-IP-Sperre, Limits; Proxy nur für gespeicherte Artikel)
  - Passwörter mit Bun.password hashen, Sitzungen nur gehasht speichern, Origin-Check
  - Nutzerisolation per Test belegen
  - I/O (db, fetch, ai, now) injizieren
  - echte RSS-/Atom-Fixtures nutzen, den Import idempotent machen
  - die bekannten Fehler aus BakeNews nicht übernehmen (leere Jaccard-Mengen = 1, Gemini-Fehler als [])
  - KI-Ergebnisse validieren, nach Provider und Prompt-Version cachen und ehrlich labeln
  - ein ehrliches README schreiben
- Evidence:
  - `bun install`, `bun run build`, `bun run typecheck` und `bun test` grün im Repo-Root, offline und ohne GEMINI_API_KEY
  - Tests für Parsing, Feeds-CRUD/Abo/Isolation, Auth inkl. Ablauf, safeFetch, Clustering-Gegenbeispiele, AI-Mock und gestubbtes Gemini inkl. Fehlerfall
  - `bun run dev` plus curl-Smoke-Test (Register → Feed → Refresh → Artikel → Zusammenfassung → Stories)
  - Browser-Durchlauf aller Seiten inklusive Ticker
  - Daten nach Neustart vorhanden
  - `git status` sauber auf bench/t2-C
- Range: Stack ersetzen, Features portieren, Abrufe absichern, KI anbinden, offline beweisen, dokumentieren -> Web-Architektur (Next.js/Bun-Monorepo), Backend-Sicherheit (Auth, SSRF, Isolation), AI-Integration (Adapter, Schema, Cache), Test Engineering

## Architecture

Bun-Workspaces-Monorepo nach BakeNews, ohne turbo. Basis Plan B, ergänzt um die strengeren Punkte aus Plan A.

Root
- package.json: workspaces [apps/*, packages/*]. dev/build/typecheck als `bun run --filter '*' <script>`, test = `bun test`. Jeder Workspace bekommt build und typecheck (`tsc --noEmit`; bei api/packages ist build = typecheck), damit der Filterlauf grün bleibt. bun.lock wird committet.
- Altbestand wird gelöscht, nicht nur abgetrennt. Das ist für Kriterium 1 nötig: `bun test` würde die Angular-*.spec.ts aufsammeln. Betroffen: src/, functions/, e2e/, angular.json, karma.conf.js, tsconfig*/tslint, firebase.json, .firebaserc, firestore.*, .browserslistrc, package-lock.json, altes package.json. Außerdem .github/workflows/firebase-hosting-*.yml, weil diese Workflows bei master-Merge deployen, .mw.toml auto_merge=true setzt und die Guardrail ‚kein Deploy‘ gilt. Erhalten bleiben LICENSE, BENCH-BRIEFING.md und .mw.toml. Die Git-Historie bewahrt den Altbestand. .gitignore um data/, .next, .env ergänzen.

apps/api (@instafeed/api): Hono auf Bun.serve mit bun:sqlite. bun:sqlite existiert nur in der Bun-Runtime, deshalb bleibt die DB im API-Prozess und nicht im Next-Bundle.
- DB: DATABASE_PATH, Standard ./data/instafeed.db, nur zur Laufzeit geöffnet. Idempotentes Schema per user_version beim Start.
- Tabellen: users(id, email unique, password_hash); sessions(token_hash pk, user_id, expires_at); feeds(id, user_id, name, url, icon, subscribed, last_error, fetched_at, unique(user_id,url)); articles(id, feed_id, guid, title, link, snippet, published_at, unique(feed_id,guid)); settings(user_id pk, theme, view, refresh_minutes, speed 1–100 ms/Zeichen wie Altbestand, default_feed_id); ai_cache(key pk, kind, provider, model, json, created_at).
- Auth: Bun.password (argon2id). Opakes Zufallstoken, nur als SHA-256 in sessions gespeichert, httpOnly-Cookie mit SameSite=Lax und 30 Tagen Ablauf; Logout löscht die Sitzung. Damit entfällt ein JWT_SECRET. Mutierende Requests mit fremdem Origin werden abgewiesen. Jede Route prüft die Sitzung und filtert per user_id; fremde IDs liefern 404.
- Feeds: Repository mit CRUD und subscribed-Flag. Feeds gehören laut Briefing dem Nutzer, kein globales Dokument mit subscribers-Array wie im Altbestand.
- Articles:
  - parseFeed(xml) als reine Funktion (rss-parser.parseString, RSS und Atom). GUID ersatzweise aus dem Link.
  - Import transaktional und idempotent per INSERT OR IGNORE.
  - Aktualisierung bei Bedarf (POST /feeds/refresh, oder beim Listenabruf, wenn älter als refresh_minutes). Fehler pro Feed landen in last_error und werden angezeigt; vorhandene Artikel bleiben.
  - Liste aus abonnierten Feeds, nach Datum absteigend, optional feedId.
  - Volltext über GET /articles/:id/content: Es werden nur Links gespeicherter Artikel eigener Feeds geladen, der Client übergibt keine freie URL. Der Text wird serverseitig extrahiert und nur als Text gerendert, kein Fremd-HTML. Bei Fehler gibt es Snippet plus Originallink.
  - Alle ausgehenden Abrufe (Feed und Volltext) laufen über eine injizierbare safeFetch: nur http(s), Timeout, Größenlimit, maximal 3 Weiterleitungen manuell, private/Loopback-Adressen nach DNS-Auflösung gesperrt. Kommentar: shortcut: DNS-Rebinding-TOCTOU offen, bei öffentlichem Betrieb festnageln.
- Settings: GET und PUT, zod-validiert.
- AI: AiAdapter { provider, model, summarize(article), describeCluster(articles) }.
  - Clustering selbst bleibt deterministisch wie BakeNews clustering.ts (Jaccard über normalisierte Titel). Korrigiert werden: leere Wortmengen gelten als ungleich, die Sortierung ist stabil, das Zeitfenster ist begrenzt (z. B. 48 h).
  - Der Adapter liefert Cluster-Titel und Zusammenfassung. Pro Cluster gibt es eine zusammengeführte Quellenliste (Feed, Link) nach dem Muster von packages/shared/src/sources.ts.
  - MockAdapter: Lead-Sätze, deterministisch.
  - GeminiAdapter: @google/genai, gemini-2.5-flash, responseSchema wie BakeNews gemini.ts, Antwort zod-validiert.
  - Factory: AI_PROVIDER=mock erzwingt den Mock, sonst Gemini bei gesetztem GEMINI_API_KEY, sonst Mock.
  - Gemini-Fehler werden als 502 sichtbar, ohne stillen Mock-Fallback und ohne leeres Array als Erfolg (BakeNews-Antimuster). Ergebnisse tragen provider und model.
  - Cache-Key = Hash(Inhalt, provider, model, PROMPT_VERSION); nur Erfolge werden gecacht.
- DI: createApp({ db, fetch, ai, now }), damit die Tests mit :memory:-SQLite, Fixture-Fetch und Mock/Stub laufen.

apps/web (@instafeed/web): Next.js App Router, TypeScript.
- Version per `bun add next@latest`; die installierte Version gilt. Keine React-Version-Pins aus BakeNews.
- Skripte `bun --bun next dev|build|start` nach Bun-Anleitung. Scheitert der Build unter --bun, fällt das Skript auf `next` zurück; das wird als shortcut im README dokumentiert.
- rewrites /api/* → API_URL (Standard http://localhost:3001), damit das Cookie same-origin ist.
- Routen-Guard je nach installierter Version (Next 16: proxy.ts, davor middleware.ts): ohne Cookie Umleitung nach /login. Die echte Prüfung macht die API.
- Seiten: /login, /register, / (Artikel plus Feed-Filter plus Aktualisieren), /articles/[id] (Volltext, KI-Zusammenfassung mit Provider-Label), /feeds, /stories (Cluster mit Quellen), /ticker (Schlagzeilen-Laufschrift; ?article=<id> scrollt dessen Volltext wie im Altbestand; Start/Stopp, Vollbild, ?autostart=true, Tempo aus Settings), /settings.
- Lade-, Leer- und Fehlerzustände sind unterschieden. Theme über data-theme und CSS, keine UI-Bibliothek. Datenzugriff über packages/api-client.

packages/shared: Domain-Typen und zod-Schemas (User, Feed, Article, Settings, Summary, StoryCluster, Source) plus mergeSources.

packages/api-client: typisierter fetch-Client nach dem Muster von BakeNews packages/api-client.

Tests (bun test, offline):
- parse-feed: RSS, Atom, fehlende Daten, kaputtes XML.
- feeds: CRUD, Abo, fremde user_id → 404, wiederholter Import ohne Duplikate.
- auth: Register, Login, Logout, abgelaufene Sitzung, 401 ohne Cookie.
- safeFetch: Schema- und Private-IP-Sperre.
- clustering: Gegenbeispiele (leere Titel, unterschiedliche Themen).
- ai: Mock deterministisch; Gemini mit gestubbtem Client inklusive Transportfehler und Schemaverletzung.

Env (README und .env.example, ohne Werte): GEMINI_API_KEY (optional), AI_PROVIDER, DATABASE_PATH, API_PORT, API_URL.

Reihenfolge:
1. Scaffold, bis install, build und typecheck grün sind. bun:sqlite-Zugriff im laufenden API-Prozess nachweisen.
2. shared und Schema.
3. Auth.
4. Feeds.
5. Parsing, Import, Proxy.
6. AI (Mock, dann Gemini).
7. Web-Seiten.
8. Ticker, Settings.
9. README, Altbestand entfernen.
10. Abnahme: curl-Smoke-Test und Browser-Durchlauf aller Wege, Persistenz nach Neustart.
11. Commit auf bench/t2-C, kein Push.

## PRDs: Scaffold: Bun-Workspaces-Monorepo (apps/web, apps/api, packages/shared, packages/api-client), Root-Skripte, Altbestand entfernen, README/.env.example, Auth: Registrieren, Anmelden, Abmelden mit lokalen Konten und serverseitigen Sitzungen, Feeds: pro Nutzer anlegen, bearbeiten, löschen, abonnieren, abbestellen, Articles: RSS-/Atom-Import, Übersicht neueste zuerst, Feed-Filter, Detail mit Volltext-Proxy, Preferences: Einstellungen pro Nutzer (Theme, Ansicht, Aktualisierung, Tempo), Ticker: Row Runner als Laufschrift der Schlagzeilen mit Start/Stopp, Vollbild, Autostart, Intelligence: KI-Adapter (Mock/Gemini) für Zusammenfassung und Story-Clustering mit Quellenliste

## Open Points

- Row Runner: Das Briefing will eine Laufschrift aus Schlagzeilen, der Altbestand scrollte den Volltext eines Artikels. Geplant ist /ticker für Schlagzeilen plus ?article=<id> für den Volltext. Das deckt beides ab.
- Quellenanalyse steht nur im Why des Briefings. Geplant ist eine zusammengeführte Quellenliste je Story-Cluster nach dem Muster aus sources.ts, aber kein eigener KI-Quellenvergleich. Faktencheck, Hintergrundrecherche und TTS aus BakeNews entfallen.
- Clustering: Die Gruppierung erfolgt deterministisch per Jaccard in beiden Modi, wie in BakeNews. Gemini oder der Mock liefert nur Cluster-Titel und Zusammenfassung. Ein reines LLM-Clustering wäre teurer und nicht testbar.
- Auth: Statt Google-Login gibt es lokale Konten mit E-Mail und Passwort. Firebase- und Firestore-Daten werden nicht migriert. Opake Sitzungen in SQLite statt JWT, damit Logout widerruft und kein JWT_SECRET nötig ist.
- Datenmodell: Feeds gehören dem Nutzer und haben ein subscribed-Flag, wie im Briefing. Das Teilen von Feeds zwischen Nutzern wie im Altbestand entfällt.
- Altbestand und Firebase-Workflows werden gelöscht: Die Angular-Specs würden `bun test` brechen, die Workflows würden wegen auto_merge deployen. Die Git-Historie bewahrt den Code.
- Versionen erst bei der Installation festlegen: next@latest (Routen-Guard proxy.ts oder middleware.ts je nach Version) und `bun --bun next`. Falls das bricht, Fallback auf Node-Next, dokumentiert. Bun 1.2.18 ist vorhanden, die Kompatibilität ist nur durch Build und laufenden Server belegt.
- Gemini wird nur mit gestubbtem Client getestet. Ein Live-Lauf mit echtem GEMINI_API_KEY braucht einen manuellen Check.
- safeFetch prüft die IP nach DNS-Auflösung, aber DNS-Rebinding zwischen Prüfung und Verbindung bleibt offen (shortcut-Kommentar). Das reicht für lokalen Betrieb, nicht für öffentliches Hosting.
- Bewusst weggelassen: turbo, drizzle, Redis/BullMQ, Hintergrund-Worker, Claude-Provider, vitest. Aktualisierung nur bei Bedarf. `bun run dev` startet zwei Prozesse; fällt die API aus, zeigt die Web-UI Fehlerzustände.
