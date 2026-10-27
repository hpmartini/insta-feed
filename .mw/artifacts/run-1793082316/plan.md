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
- Evidence:
  - `bun install`, `bun run build`, `bun run typecheck` und `bun test` grün im Repo-Root, offline und ohne GEMINI_API_KEY
  - Tests für Parsing, Feeds-CRUD/Abo/Isolation, Auth inkl. Ablauf, safeFetch, Clustering-Gegenbeispiele, AI-Mock und gestubbtes Gemini inkl. Fehlerfall
  - `bun run dev` plus curl-Smoke-Test (Register → Feed → Refresh → Artikel → Zusammenfassung → Stories)
  - Browser-Durchlauf aller Seiten inklusive Ticker
  - Daten nach Neustart vorhanden
  - `git status` sauber auf bench/t2-C
- Range: Stack ersetzen, Features portieren, Abrufe absichern, KI anbinden, offline beweisen, dokumentieren -> Web-Architektur (Next.js/Bun-Monorepo), Backend-Sicherheit (Auth, SSRF, Isolation), AI-Integration (Adapter, Schema, Cache), Test Engineering

## Umsetzungsschritte

1. **Verträge aus vorhandenem Backend festschreiben.** Grundlage: `apps/api/src/app.ts`, `auth.ts`, `feeds.ts`, `articles.ts`, `ai/routes.ts`, `settings.ts` und `packages/shared/src/schemas.ts`. Umfang dieses Issues: Client, gemeinsame Verträge und erforderliche same-origin-Anbindung. Ticker, vollständige Frontend-Portierung und weitere Backend-Härtung bleiben übergeordnete Ambition.

   | Bereich | Abzudeckende Routen | Rückgaben |
   |:--|:--|:--|
   | Health | `GET /health` | `HealthResponse` |
   | Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | `User`, Logout `void` |
   | Feeds | `GET /feeds`, `POST /feeds`, `GET /feeds/:id`, `PATCH /feeds/:id`, `DELETE /feeds/:id`, `POST /feeds/:id/refresh` | `Feed[]`, `Feed`, Löschen `void`, `{ feed, imported }` |
   | Artikel | `GET /articles?feedId=` | `Article[]` |
   | Inhalt | `GET /articles/:id/content` | `{ text, url, fallback }` |
   | Zusammenfassung | `POST /articles/:id/summary` | `Summary` |
   | Stories | `GET /stories` | `StoryCluster[]` |
   | Einstellungen | `GET /settings`, `PUT /settings` | `Settings` |

2. **Gemeinsame Ein- und Ausgabetypen ergänzen.** Auth-Zugangsdaten, Feed-Anlage/-Änderung, Artikel-Filter, Refresh- und Inhaltsantwort zentral exportieren. Bestehende Domänentypen wiederverwenden. Feed-Eingaben exakt abbilden: `url`/`title` bei Anlage erforderlich, `iconUrl` optional oder `null`, Update ohne Besitzerfelder; Einstellungen vollständig mit bisherigen snake_case-Feldern. Bei gemeinsam genutzten Schemas bisherige Backend-Validierung erhalten.

3. **Fetch-Kern und typisierte Fehler implementieren.** `packages/api-client/src/index.ts` erweitern; vorhandene Fetch-Injektion und `health()` erhalten. Browser-Standardbasis `/api`, explizite Basis weiterhin möglich; abschließende Schrägstriche normalisieren, IDs und Queryparameter kodieren. Jeder Request mit `credentials: "same-origin"`; JSON-Header nur bei entsprechendem Body. `204` ohne JSON-Parsing behandeln. Exportierten `ApiError` mit unterscheidbaren HTTP-, Netzwerk- und Antwortformatfehlern vorsehen; Status, Servermeldung und validierte Fehlerdetails erhalten. Refresh-Fehler `502` samt `feed`/`imported` zugänglich machen; Textfehler und kaputte Fehlerantworten robust behandeln. Erfolgsantworten anhand gemeinsamer Schemas prüfen.

4. **Alle 17 Methoden an gemeinsamen Fetch-Kern anschließen.** Explizite Eingabe- und Rückgabetypen; keine öffentlichen `any`-Typen oder frei wählbaren generischen Rückgaben. Abonnieren über vorhandenes `PATCH` mit `subscribed`, Einstellungen über vollständiges `PUT`. Keine automatischen Wiederholungen mutierender Requests.

5. **Same-origin-Verbindung im Web herstellen.** Browserzugriffe über `/api`; Proxyziel ausschließlich serverseitig konfigurieren. Next.js-Proxyverhalten vor Auswahl anhand installierter Dokumentation prüfen. Cookies, `Set-Cookie`, Queryparameter, Status und leere Antworten durchreichen; Authantworten nicht cachen. Tatsächlich beim Backend ankommenden Origin und Request-URL prüfen: gültige Web-Anfragen müssen funktionieren, fremde Origins weiterhin scheitern. Falls Origin-Übersetzung erforderlich: eingehenden Origin zuerst gegen Web-Origin validieren. Backend-Originprüfung erhalten. `.env.example` und README auf Browserpfad sowie internes Proxyziel umstellen; keine zusätzlichen Frontend-Seiten bauen.

6. **Vertrag und Sitzungsfluss belegen.** Clienttests mit injiziertem Fetch für sämtliche Methoden, Pfade, Bodies, Filter, Kodierung und Cookieoption; zusätzlich `204`, Fehlerstatus `400/401/403/404/409/502`, Refresh-Fehlerdetails, Netzwerkfehler und ungültige Antworten. Typprüfung um ungültige Eingaben und erwartete Rückgabetypen ergänzen. Integration mit `createApp`, In-Memory-Datenbank und Mock-Anbieter für Anmeldung, Feed, Refresh, Artikel, Inhalt, Zusammenfassung, Stories, Einstellungen und Logout. Browser-Sitzungsfluss über tatsächlichen Web-Origin prüfen; Fremd-Origin-Ablehnung separat belegen. Fetch-Stubs allein beweisen keine Browser-Cookies.

7. **Abnahme und Übergabe durchführen.** Im schreibfähigen Builder nach Dependency-Installation zuerst `bun run typecheck`, danach gezielte Client-/Integrationstests, `bun test` und `bun run build`; ohne Gemini-Schlüssel und externe Testabrufe. `bun install` als separaten Installationsschritt ausweisen; Offline-Erfolg nur bei tatsächlich verfügbarem Dependency-Cache behaupten. README mit Clientbeispiel, Fehlerbehandlung, same-origin-Konfiguration und verbleibenden Grenzen ergänzen. Abschließend Diff und Status auf unbeabsichtigte Änderungen prüfen; keine fremden Änderungen bereinigen.

## Befund und Übergabe

- Geprüft: Repository-Vorgaben, Codegraph, Router, Handler, Shared-Schemas, Client, Web-Gerüst, Konfiguration und Lockfile.
- Ergebnis: Client bisher ausschließlich `health()`; Web-Seite Platzhalter; `.env.example` verweist auf anderen Port, Backend prüft mutierende Origins.
- Geänderte Dateien: keine; Arbeitsstand vor und nach Untersuchung sauber; `plan.md` nicht geschrieben.
- Geplante Dateien: `packages/api-client/src/*`, `packages/shared/src/*`, erforderliche Proxydateien unter `apps/web`, `README.md`, `.env.example`; Paketdateien, `bun.lock` und TypeScript-Konfiguration nur bei konkretem Bedarf.
- Ausgeführt: `graphify query`, `graphify explain`, Quellcode-/Konfigurationsprüfung und `git status` erfolgreich.
- Typecheck: `bun run typecheck` fehlgeschlagen, sämtliche Workspaces mit `TS2688` wegen nicht auflösbarer Bun-Typen; Web zusätzlich Schreibversuch für `tsconfig.tsbuildinfo` mit `EPERM` abgelehnt. `tsc -p packages/api-client/tsconfig.json --incremental false` bestätigt `TS2688` unabhängig vom Cache-Schreibversuch.
- Offen: Installation und Abnahme im Builder; Build und Tests hier nicht ausgeführt. Proxy-Originverhalten und Browser-Cookiefluss benötigen Integrationsnachweis; übergeordnete Ambition dadurch noch nicht vollständig erfüllt.