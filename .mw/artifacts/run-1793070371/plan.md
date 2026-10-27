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

1. **Ausgangslage sichern.** Vor Änderungen erneut `git status` und `git diff` prüfen. Codegraph bereits konsultiert; anschließend Auth, Datenbankschema, Shared-Schemas und bestehende Tests gelesen. Feed-Routen und Feed-Tests fehlen. Vorhandene Datenbank erzwingt bereits `unique(user_id, url)`; keine Migration nötig. Gesamtambition bleibt Kontext; Umsetzung auf Feed-Verwaltung begrenzen.

2. **Vertrag festlegen.** `GET /feeds` liefert eigene Feeds einschließlich abbestellter; `POST /feeds` erstellt mit Status 201; `GET /feeds/:id` liest, `PATCH /feeds/:id` bearbeitet mit Status 200; `DELETE /feeds/:id` löscht mit Status 204. Abo über `PATCH` mit `{ subscribed: true | false }`; wiederholtes Setzen bleibt idempotent. Fehlende Sitzung → 401, fremde oder unbekannte Feed-ID → 404, ungültige Eingabe → 400, eigene doppelte URL → 409.

3. **Validierung in `apps/api/src/feeds.ts`.** Eingabeschemas aus bestehendem `FeedSchema` ableiten; keine zusätzliche Bibliothek nötig. Erlaubte Schreibfelder: `url`, `title`, `iconUrl`, `subscribed`. Erstellen benötigt HTTP(S)-URL und nichtleeren, getrimmten Titel; Abo standardmäßig aktiv. Bearbeiten akzeptiert mindestens ein erlaubtes Feld; ausgelassene Felder behalten ihren Wert, `iconUrl: null` entfernt vorhandenes Icon. Unbekannte Felder einschließlich `id`, `userId` und `user_id` zurückweisen. Fehlerhaftes JSON, Arrays, `null`, falsche Typen und Nicht-HTTP(S)-URLs abweisen.

4. **Nutzergebundene Speicherung implementieren.** Besitzer ausschließlich aus authentifizierter Sitzung übernehmen. Jede Feed-Abfrage und Mutation mit `user_id` einschränken; Einzelzugriffe zusätzlich mit Feed-ID. Besitzerprüfung vor Bearbeitungsvalidierung, damit fremde IDs konsequent 404 liefern. Werte über SQL-Parameter binden; Datenbankfelder in Shared-Feed-Format überführen, `subscribed` als Boolean, fehlendes Icon auslassen. Konflikte der URL-Eindeutigkeit gezielt als 409 behandeln; fehlgeschlagenes Update lässt vorhandene Daten unverändert.

5. **Löschen vollständig behandeln.** Bestehender Fremdschlüssel `settings.default_feed_id` verhindert sonst Löschen eines Standardfeeds. In einer Transaktion eigene Referenz auf diesen Feed leeren und eigenen Feed löschen; vorhandene Artikel über bestehende Kaskade entfernen. Fremde Referenzen und Feeds bleiben unverändert. Abbestellen ändert ausschließlich Abo-Status und erhält Artikel.

6. **Routing in `apps/api/src/app.ts` ergänzen.** Feed-Handler hinter bestehender Sitzungsprüfung aufrufen; vorhandenen Origin-Check beibehalten. Identität explizit an Handler übergeben; bestehende Injektion verwenden. Kein Netzwerkabruf beim Anlegen, Bearbeiten oder Abonnieren. Unbekannte Pfade bleiben 404.

7. **`apps/api/test/feeds.test.ts` ergänzen.** Pro Test isolierte Speicherdatenbank; zwei Nutzer mit gültigen Sitzungen; Netzwerk- und KI-Stubs werfen bei unerwarteter Nutzung. Über `createApp` prüfen: vollständiger Lebenszyklus, Ausgabeformat, Teilupdates, Icon-Entfernung, Abo/Abbestellung einschließlich Wiederholung, Listenisolation, eigene URL-Dubletten bei Erstellung und Bearbeitung, gleiche URL verschiedener Nutzer erlaubt. Fremde und unbekannte IDs bei Lesen/Bearbeiten/Löschen jeweils 404; fremde Abo-Änderung ebenfalls 404. Zusätzlich manipulierte Besitzerfelder, ungültige Eingaben, 401 ohne Sitzung, 403 bei fremdem Origin, unveränderte Daten nach Fehlern sowie Löschen eines Standardfeeds mit Artikeln prüfen.

8. **Validieren und dokumentieren.** Builder installiert Abhängigkeiten über `bun install`; offline Verfügbarkeit prüfen. Danach `bun test apps/api/test/feeds.test.ts`, `bun run typecheck`, `bun run build` und `bun test`; Fehler konkret auswerten. README um Feed-Vertrag und tatsächlichen Funktionsstand ergänzen. Abschließend Diff auf Umfang und Status auf unbeabsichtigte Änderungen prüfen. Paketdateien, Lockdatei und Konfiguration nur bei nachgewiesener Notwendigkeit ändern.

## Prüfstand und Übergabe

- Untersucht: Codegraph, Auth, Routing, Datenbankschema, Shared-Verträge, Testmuster und Repository-Regeln; Arbeitsstand sauber auf `issue-30`.
- Geänderte Dateien: keine; `plan.md` wegen Nur-Lese-Auftrag nicht angelegt. Vorgesehene Änderungen: `apps/api/src/feeds.ts`, `apps/api/src/app.ts`, `apps/api/test/feeds.test.ts`, `README.md`.
- `graphify query "Where are feed routes, persistence, authentication and API tests implemented?"`: erfolgreich; relevante Dateien gefunden.
- `bun test apps/api/test/feeds.test.ts`: fehlgeschlagen; Testdatei fehlt.
- `bun test apps/api/test/auth.test.ts`: 0 bestanden, 1 Fehler; `@insta-feed/shared` nicht auflösbar.
- `bun run typecheck`: Exit 2; Bun-Typdefinitionen fehlen, zusätzlich Schreibversuch für Web-TypeScript-Cache mit `EPERM` abgewiesen. Keine Dateien geändert.
- Offen: Implementierung und erfolgreiche Abnahme; Abhängigkeiten noch nicht installiert. Gesamtambition einschließlich Browser-, Import- und KI-Nachweisen durch diesen Feed-Schritt nicht erfüllt.
- Nächster Schritt: Builder setzt Schritte 1–8 um; Zielbranch `bench/t2-C` vor Integration mit aktuellem Branch `issue-30` abgleichen.