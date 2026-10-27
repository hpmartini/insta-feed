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

1. **Verträge und Grenzen festlegen.** Bestehende Authentifizierung, Origin-Prüfung und injizierte Abhängigkeiten übernehmen. Bedarfsaktualisierung als `POST /feeds/:id/refresh` vorsehen; `GET /articles?feedId=…` liest gespeicherte Artikel. Inhaltsantwort als `{ text, url, fallback }` definieren. Größere Ambition bleibt Orientierung; KI, Ticker und Frontend-Portierung gehören nicht zu diesem Arbeitspaket.

2. **Reinen Parser ergänzen.** `rss-parser` in `apps/api/package.json` aufnehmen, `bun.lock` aktualisieren. `apps/api/src/parse-feed.ts`: ausschließlich `parseString(xml)`, keine Netzwerk-, Datenbank-, Uhrzeit- oder Zufallszugriffe; Promise mit normalisierten Artikelentwürfen zurückgeben. Kennung aus GUID beziehungsweise Atom-ID, ersatzweise gültigem Link; fehlenden Titel deterministisch ersetzen, fehlendes Snippet als Leerstring, fehlendes oder ungültiges Datum auslassen. Einträge ohne verwendbaren http(s)-Link überspringen; kaputtes XML als Fehler weiterreichen. Wiederholtes Parsen liefert gleiche Ergebnisse. Schnittstelle anhand [rss-parser-Dokumentation](https://github.com/rbren/rss-parser#usage) prüfen.

3. **safeFetch als gemeinsame Abrufgrenze bauen.** `apps/api/src/safe-fetch.ts`: injizierbare Fetch- und DNS-Auflösung (Domain Name System), feste Standardlimits, ausschließlich http(s), keine URL-Zugangsdaten. Normalisierte IP-Literale und sämtliche aufgelösten Adressen prüfen; Loopback, private, Link-Local und weitere nicht öffentliche Bereiche einschließlich IPv4-in-IPv6 sperren. Leere oder fehlerhafte Auflösung ablehnen. Weiterleitungen manuell verfolgen, jedes Ziel erneut prüfen, höchstens drei Weiterleitungen. Eine Gesamtlaufzeit für Auflösung, Weiterleitungen und Body; Größenlimit während des Stream-Lesens, unabhängig von `Content-Length`; bei Abbruch Reader und Anfrage beenden. Vollständig begrenzten Inhalt zurückgeben, damit Body-Lesen Schutz nicht umgeht. Keine Sitzungscookies weiterreichen. DNS-Injektion über bestehende Abhängigkeitsstruktur verdrahten; unterstützte Schnittstellen mit installiertem Bun abgleichen, siehe [Bun-Dokumentation](https://bun.sh/docs/runtime/networking/dns).

4. **Persistenz und Import ergänzen.** `apps/api/src/db.ts`: additive Migration für nullable `feeds.last_error`, Schema-Version erhöhen; bestehende Migration unverändert lassen. In `articles.ts` Feed zunächst über Sitzungseigentümer laden, erst danach abrufen. Netzwerk und Parsing vor kurzer Schreibtransaktion; Artikel mit expliziten Spalten und `INSERT OR IGNORE` importieren, bestehendes `UNIQUE(feed_id, guid)` nutzen. Erfolg löscht `last_error`; Abruf- oder Parsingfehler speichert begrenzte Fehlermeldung ausschließlich am betroffenen Feed, vorhandene Artikel bleiben erhalten. Eigenschaft optional über Shared-Schema und Feed-Abbildung exponieren. Während Abruf gelöschte oder geänderte Feeds vor Import erneut prüfen.

5. **Routen und Inhaltsextraktion integrieren.** `app.ts`: Refresh-Route vor allgemeiner `/feeds/*`-Weiterleitung behandeln; Artikelrouten nach Authentifizierung einhängen. Artikelliste immer nach Nutzer filtern, optional nach eigenem Feed; `published_at DESC, id DESC`, undatierte Artikel zuletzt. Inhaltsroute lädt Artikel samt eigenem Feed vor jedem Netzwerkzugriff; fremde und unbekannte Kennungen → 404 ohne Abruf. Nur gespeicherten Artikellink verwenden, keine Ziel-URL aus Request übernehmen. HTML ohne Skriptausführung oder Nachladen von Ressourcen in Text extrahieren; Skripte, Styles und Navigation ausschließen, Entitäten und Absatzgrenzen erhalten. Abruf-, Status-, Extraktionsfehler oder leeres Ergebnis → gespeichertes Snippet plus Original-Link, `fallback: true`.

6. **Gezielte Nachweise ergänzen.** `parse-feed.test.ts` und lokale, mit Herkunft belegte RSS-/Atom-Fixtures: Datumsnormalisierung, fehlende Felder, ungültige Links, leere Feeds, kaputtes XML und deterministische Ergebnisse. `safe-fetch.test.ts`: unerlaubte Schemas, normalisierte IPv4-Schreibweisen, IPv6 und eingebettete IPv4, gemischte öffentliche/private DNS-Antworten, private Weiterleitungsziele, drei erlaubte und vierte abgelehnte Weiterleitung, Timeout einschließlich langsamen Bodys, Größenüberschreitung ohne verlässliche Längenangabe. Sämtliche Auflösungen und Abrufe stubben. `articles.test.ts`: wiederholter und überlappender Import ohne Duplikate, Nutzerisolation einschließlich Refresh und Inhaltsroute, Sortierung/Filter, Fehlerstatus pro Feed samt Rücksetzung, Extraktion und Fallback. Migrationstest für vorhandene Version-1-Daten ergänzen.

7. **Dokumentieren und abschließen.** README um Routen, Antwortverträge, Limits, Fallback und verbleibende Sicherheitsgrenze erweitern. Direkt zwischen DNS-Prüfung und Fetch folgenden Kommentar platzieren: `shortcut: DNS wird vorab geprüft; fetch löst erneut auf. DNS-Rebinding bleibt möglich. Entfernung: Verbindung an geprüfte IP binden, Host und TLS-Zertifikatsprüfung erhalten.` Nach Dependency-Installation zuerst drei Acceptance-Tests einzeln, danach `bun test`, `bun run typecheck`, `bun run build`. Offline-Nachweis mit vorhandenen Dependencies und ohne `GEMINI_API_KEY`; Installation ohne Cache nicht als offlinefähig behaupten. Persistenz nach erneutem Öffnen prüfen. Keine vollständige Erfüllung der übergeordneten KI-/Browser-Ambition behaupten.

## Übergabe

- Erledigt: Repository-Vorgaben, Codegraph, Anwendung, Datenbankschema, Feed-Tests und Shared-Verträge geprüft; Umsetzung geplant.
- Ergebnis: Parser, Artikelrouten und safeFetch fehlen; Artikel-Eindeutigkeit und Eigentümerbeziehung bereits vorhanden; `last_error` benötigt Migration.
- Geänderte Dateien: keine; `plan.md` nicht geschrieben; Arbeitsbaum vor und nach Prüfung sauber, Branch `issue-31`.
- Geplante Dateien: drei neue Quellmodule, `app.ts`, `db.ts`, `feeds.ts`, Shared-Schema, API-Paketmanifest, `bun.lock`, drei neue Tests samt Fixtures, Migrationstest und README.
- Befehle: `graphify query …` erfolgreich; `git status`/`git diff` sauber. Acceptance-Testaufruf fehlgeschlagen: alle drei Testdateien fehlen.
- Tests: `bun test` fehlgeschlagen, 0 bestanden/4 fehlgeschlagen; Workspace-Abhängigkeiten und `zod` nicht auflösbar. `bun run typecheck` fehlgeschlagen: Bun-Typen fehlen; zusätzlich Schreibversuch für TypeScript-Buildinfo mit `EPERM` abgelehnt. Installation und Build nicht ausgeführt.
- Offen: DNS-Rebinding bleibt dokumentierte Sicherheitslücke; Refresh-Pfad und Inhaltsantwort sind vorgeschlagene Verträge. Vollständige Ambition und Zielbranch `bench/t2-C` hier nicht nachgewiesen.
- Nächster Schritt: Plan im schreibberechtigten Builder umsetzen; Dependencies installieren und genannte Nachweise ausführen.