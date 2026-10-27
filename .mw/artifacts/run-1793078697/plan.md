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

## Umsetzungsschritte

1. **Settings-Vertrag festlegen.** Vor Änderungen erneut `git status` und betroffene Diffs prüfen. Graphorientierung bereits erfolgt. Befund: Routen/Testdatei fehlen; `settings` enthält ausschließlich `user_id`, `speed`, `default_feed_id`; Shared-Schema ausschließlich `speed` und `defaultFeedId`. Legacy-Settings gegebenenfalls aus lokaler Git-Historie lesen. Theme-/Ansichtswerte und Aktualisierungsvorgabe bisher unbelegt. Falls dort keine Vorgaben: ausdrücklich dokumentierter Vorschlag `theme: system|light|dark`, `view: list|row-runner`, `refresh_minutes: 15`, `speed: 30`, `default_feed_id: null`. Vertragsnamen `refresh_minutes`/`default_feed_id` gemäß Auftrag; bisherigen Shared-Namen `defaultFeedId` konsistent ersetzen, Referenzen prüfen. PUT als vollständiges Ersetzen aller fünf Felder; Defaults ausschließlich für initiales Anlegen.

2. **Shared-Schema und Eingabevalidierung ergänzen.** In `packages/shared/src/schemas.ts` zentrale Felddefinitionen, Defaults und Typen ergänzen. Tempo als endliche Zahl inklusive Grenzen 1–100 ms/Zeichen; keine zusätzliche Ganzzahlpflicht ohne fachlichen Grund. `refresh_minutes` als positive Ganzzahl; Theme/Ansicht als feste Enumerationen; Feed-Vorgabe als nichtleere ID oder `null`. Striktes PUT-Schema ohne Default-Ergänzung: fehlende/zusätzliche Felder, Eigentümerangaben, falsche Typen und fehlerhaftes JSON → 400. Bestehenden Schema-Test in `packages/shared/src/sources.test.ts` aktualisieren.

3. **Persistenz additiv migrieren.** In `apps/api/src/db.ts` dritte Migration für Theme, Ansicht und Aktualisierung ergänzen; historische Migrationen unverändert lassen. `SCHEMA_VERSION` erhöhen; vorhandene Settings mit neuen Defaults erhalten, Tempo/Feed-Vorgabe bewahren. Bestehenden zusammengesetzten Fremdschlüssel zur Nutzerisolation erhalten. In `apps/api/test/db.test.ts` Upgrade vorhandener Settings und wiederholte Migration prüfen. Bestehenden v1→v2-Test auf expliziten v2-Zielstand begrenzen: dessen feste Erwartung `2` scheitert sonst nach Einführung von v3.

4. **GET und PUT implementieren.** Neues `apps/api/src/settings.ts`; Datenbank ausschließlich aus `Deps`, Nutzer ausschließlich aus Sitzung. GET initialisiert mit `INSERT … ON CONFLICT(user_id) DO NOTHING`, liest anschließend eigene Zeile und liefert 200; wiederholtes GET überschreibt keine Einstellungen. PUT validiert vollständig vor Schreibzugriff, prüft Feed-Eigentum mit `id` und `user_id`, speichert atomar per Upsert und liefert gespeicherten Zustand mit 200. PUT vor erstem GET unterstützen. Fremde/unbekannte Feed-ID einheitlich → 404 ohne Teiländerung; `null` entfernt Vorgabe. In `apps/api/src/app.ts` ausschließlich GET/PUT `/settings` hinter bestehender Authentifizierung einhängen; vorhandenen Origin-Check übernehmen. Bestehende Feed-Löschung leert Vorgabe bereits transaktional; Integration absichern.

5. **Akzeptanztests ergänzen.** `apps/api/test/settings.test.ts` mit isolierter In-Memory-Datenbank, festen Uhrzeiten und bei Nutzung fehlschlagenden Netzwerk-/KI-Stubs. Prüfen: vor erstem GET keine Settings-Zeile; danach korrekte Defaults, genau eine Zeile, keine Anlage für andere Nutzer; PUT-Roundtrip, PUT vor GET und idempotente Wiederholung; Tempo 1/100 akzeptiert, außerhalb abgelehnt; ungültige Eingaben ohne Zustandsänderung; fehlende/abgelaufene Sitzung → 401; fremder Origin → 403; zwei Nutzer mit unabhängigen Einstellungen; eigener/fremder/unbekannter Default-Feed; explizites Zurücksetzen und Löschen des Default-Feeds. Persistenz nach erneutem Öffnen derselben Datenbank im schreibberechtigten Builder prüfen.

6. **Dokumentieren und verifizieren.** README: Settings-Vertrag, Defaults, Tempoeinheit, PUT-Verhalten, Fehlercodes und Schema-Version aktualisieren; Settings aus Liste fehlender Funktionen entfernen. Keine neuen Abhängigkeiten oder Änderungen an Frontend, KI, Umgebungsvariablen oder Workspace-Konfiguration erforderlich. Im Builder zunächst `bun install --frozen-lockfile`, danach `bun test apps/api/test/settings.test.ts`, betroffene Feed-/Datenbank-/Shared-Tests, `bun run typecheck`, `bun test` und `bun run build`. Alle Ergebnisse getrennt protokollieren; abschließend Diff und Status auf unbeabsichtigte Änderungen prüfen. Breite Ambition bleibt Orientierung; KI-/Frontend-Portierung außerhalb dieses Settings-Auftrags.

## Übergabe

- Erledigt: Repository-Vorgaben, Codegraph, Settings-Schema, Routing, Authentifizierung, Feed-Löschung und Migrationstests untersucht.
- Ergebnis: Settings-Implementierung fehlt; additive Migration und Shared-Vertragsänderung erforderlich.
- Dateien geändert: keine; `git status --porcelain=v1` und `git diff --stat` leer.
- Befehle: `graphify query`, `graphify explain SettingsSchema`, `graphify affected SettingsSchema` erfolgreich; gezielte Quellcodeprüfungen abgeschlossen.
- Akzeptanztest: `bun test apps/api/test/settings.test.ts` → Exit 1, Testdatei fehlt.
- Bestandstests: `bun test apps/api/test/feeds.test.ts packages/shared/src/sources.test.ts` → Exit 1, 0 bestanden, 2 Ladefehler; `@insta-feed/shared` und `zod` nicht auflösbar.
- Offen: Theme-/Ansichtswerte, Aktualisierungsdefault und PUT-Semantik fachlich nicht vorgegeben; oben ausdrücklich vorgeschlagen. Alte gespeicherte Tempo-Werte könnten außerhalb neuer Grenzen liegen; vor Migration prüfen, Behandlung festlegen.
- Nächster Schritt: Builder setzt Vertrag und Migration um, installiert Abhängigkeiten und führt Prüfungen aus; keine Installation, Build-Artefakte oder Dateiänderungen durch diesen Worker.